import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { BackupHistoryEntity } from '../entities/backup-history.entity';
import { StorageService } from '../../../services/storage.service';

const execAsync = promisify(exec);

/**
 * Backup Jobs — sesuai jadwal WITA:
 *   backup-full        : setiap hari 02:00 → pg_dump + AES-256 + R2
 *   backup-incremental : 08:00, 14:00, 20:00 → pg_dump (incremental = full dump, tandai incremental)
 *   backup-cleanup     : setiap hari 03:00 → hapus backup > retention_days
 *   backup-verify      : setiap Minggu 03:00 → cek file backup terakhir ada di R2
 */
@Injectable()
export class BackupJob {
  private readonly logger = new Logger(BackupJob.name);

  constructor(
    @InjectRepository(BackupHistoryEntity)
    private backupRepo: Repository<BackupHistoryEntity>,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  // ── Full backup: setiap hari 02:00 WITA ─────────────────────
  @Cron('0 0 2 * * *', { timeZone: 'Asia/Makassar' })
  async runFullBackup(): Promise<void> {
    await this.runBackup('full');
  }

  // ── Incremental: 08:00, 14:00, 20:00 WITA ──────────────────
  @Cron('0 0 8,14,20 * * *', { timeZone: 'Asia/Makassar' })
  async runIncrementalBackup(): Promise<void> {
    await this.runBackup('incremental');
  }

  // ── Cleanup: setiap hari 03:00 WITA ─────────────────────────
  @Cron('0 0 3 * * *', { timeZone: 'Asia/Makassar' })
  async runCleanup(): Promise<void> {
    const retentionDays = this.config.get<number>('BACKUP_RETENTION_DAYS') ?? 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    try {
      const oldBackups = await this.backupRepo
        .createQueryBuilder('b')
        .where('b.started_at < :cutoff', { cutoff })
        .andWhere('b.status = :status', { status: 'success' })
        .getMany();

      for (const backup of oldBackups) {
        if (backup.file_path) {
          try {
            const r2Key = backup.file_path.startsWith('backups/')
              ? backup.file_path
              : `backups/${backup.file_path}`;
            await this.storage.delete(r2Key);
            this.logger.log(`Deleted old backup: ${r2Key}`);
          } catch (e) {
            this.logger.warn(`Could not delete backup file ${backup.file_path}: ${(e as Error).message}`);
          }
        }
        await this.backupRepo.delete(backup.id);
      }

      if (oldBackups.length > 0) {
        this.logger.log(`Cleanup: ${oldBackups.length} backup lama dihapus (retention ${retentionDays} hari)`);
      }
    } catch (err) {
      this.logger.error(`BackupCleanup error: ${(err as Error).message}`);
    }
  }

  // ── Verify: setiap Minggu 03:00 WITA ────────────────────────
  @Cron('0 0 3 * * 0', { timeZone: 'Asia/Makassar' }) // Minggu
  async runVerify(): Promise<void> {
    try {
      // Cek backup terakhir yang sukses
      const latest = await this.backupRepo.findOne({
        where: { status: 'success', type: 'full' },
        order: { finished_at: 'DESC' },
      });

      if (!latest) {
        this.logger.warn('BackupVerify: Tidak ada backup sukses yang ditemukan');
        return;
      }

      const ageHours = latest.finished_at
        ? (Date.now() - new Date(latest.finished_at).getTime()) / 3_600_000
        : 999;

      if (ageHours > 26) {
        this.logger.error(
          `BackupVerify: Backup terakhir berumur ${ageHours.toFixed(1)} jam (threshold 26 jam). Cek sistem backup!`,
        );
      } else {
        this.logger.log(
          `BackupVerify: Backup terakhir OK — ${ageHours.toFixed(1)} jam yang lalu (${latest.file_path ?? 'unknown'})`,
        );
      }
    } catch (err) {
      this.logger.error(`BackupVerify error: ${(err as Error).message}`);
    }
  }

  // ── Core: pg_dump + AES-256 + R2 upload ─────────────────────
  private async runBackup(type: 'full' | 'incremental'): Promise<void> {
    const record = this.backupRepo.create({ type, status: 'running', started_at: new Date() });
    const saved = await this.backupRepo.save(record);

    const tmpDir = '/tmp';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpFile = path.join(tmpDir, `backup-${timestamp}.sql`);
    const encFile = `${dumpFile}.enc`;

    try {
      // pg_dump
      const dbHost     = this.config.get('database.host')     ?? 'postgres';
      const dbPort     = this.config.get('database.port')     ?? 5432;
      const dbUser     = this.config.get('database.username') ?? 'postgres';
      const dbName     = this.config.get('database.name')     ?? 'attendenx';
      const dbPassword = this.config.get('database.password') ?? '';

      const pgDumpCmd = `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} ${dbName} > ${dumpFile}`;
      await execAsync(pgDumpCmd);

      const rawStats = fs.statSync(dumpFile);
      const rawSize = rawStats.size;

      // AES-256-CBC encryption
      const encKeyHex = this.config.get<string>('BACKUP_ENCRYPTION_KEY') ?? '';
      const encIvHex  = this.config.get<string>('BACKUP_IV')             ?? '';

      let uploadBuffer: Buffer;
      if (encKeyHex && encIvHex && encKeyHex.length === 64 && encIvHex.length === 32) {
        const key = Buffer.from(encKeyHex, 'hex');
        const iv  = Buffer.from(encIvHex, 'hex');
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        const input  = fs.readFileSync(dumpFile);
        uploadBuffer = Buffer.concat([cipher.update(input), cipher.final()]);
        fs.writeFileSync(encFile, uploadBuffer);
      } else {
        this.logger.warn('BACKUP_ENCRYPTION_KEY/IV tidak dikonfigurasi — upload tanpa enkripsi');
        uploadBuffer = fs.readFileSync(dumpFile);
      }

      // Hitung checksum
      const checksum = crypto.createHash('sha256').update(uploadBuffer).digest('hex');

      // Upload ke R2
      const r2Path = this.config.get<string>('BACKUP_R2_PATH') ?? 'backups/';
      const fileName = encKeyHex ? `${r2Path}backup-${type}-${timestamp}.sql.enc` : `${r2Path}backup-${type}-${timestamp}.sql`;
      await this.storage.upload(r2Path, fileName.replace(r2Path, '').replace(/\.[^.]+$/, ''), uploadBuffer, 'application/octet-stream');

      // Update record
      await this.backupRepo.update(saved.id, {
        status: 'success',
        size_bytes: rawSize,
        file_path: fileName,
        checksum,
        finished_at: new Date(),
      });

      this.logger.log(`Backup ${type} sukses: ${fileName} (${(rawSize / 1024 / 1024).toFixed(2)} MB)`);
    } catch (err) {
      const errMsg = (err as Error).message;
      await this.backupRepo.update(saved.id, {
        status: 'failed',
        finished_at: new Date(),
        error_msg: errMsg.substring(0, 500),
      });
      this.logger.error(`Backup ${type} gagal: ${errMsg}`);
    } finally {
      // Hapus file temp
      for (const f of [dumpFile, encFile]) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
    }
  }
}
