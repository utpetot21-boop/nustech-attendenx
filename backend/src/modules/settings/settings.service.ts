import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyAttendanceConfigEntity } from './entities/company-attendance-config.entity';
import { CompanyProfileEntity } from './entities/company-profile.entity';
import { BackupHistoryEntity } from './entities/backup-history.entity';
import { UpdateAttendanceConfigDto } from './dto/update-attendance-config.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { BackupJob } from './jobs/backup.job';
import { witaToday } from '../../common/utils/date.util';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(CompanyAttendanceConfigEntity)
    private attendanceConfigRepo: Repository<CompanyAttendanceConfigEntity>,
    @InjectRepository(CompanyProfileEntity)
    private profileRepo: Repository<CompanyProfileEntity>,
    @InjectRepository(BackupHistoryEntity)
    private backupRepo: Repository<BackupHistoryEntity>,
    @Optional() private readonly backupJob?: BackupJob,
  ) {}

  // ── Profil Perusahaan ─────────────────────────────────────────────────────
  async getProfile(): Promise<CompanyProfileEntity> {
    const profiles = await this.profileRepo.find({ order: { updated_at: 'DESC' }, take: 1 });
    if (!profiles.length) throw new NotFoundException('Profil perusahaan belum diatur');
    return profiles[0];
  }

  async updateProfile(dto: UpdateProfileDto): Promise<CompanyProfileEntity> {
    const profiles = await this.profileRepo.find({ order: { updated_at: 'DESC' }, take: 1 });
    if (!profiles.length) {
      return this.profileRepo.save(this.profileRepo.create(dto));
    }
    const profile = profiles[0];
    Object.assign(profile, dto);
    return this.profileRepo.save(profile);
  }

  // ── Aturan Absensi ────────────────────────────────────────────────────────
  async getAttendanceConfig(): Promise<CompanyAttendanceConfigEntity> {
    const configs = await this.attendanceConfigRepo.find({ order: { effective_date: 'DESC' }, take: 1 });
    const config = configs[0] ?? null;
    if (!config) throw new NotFoundException('Konfigurasi absensi belum diatur');
    return config;
  }

  async updateAttendanceConfig(
    dto: UpdateAttendanceConfigDto,
    adminId: string,
  ): Promise<CompanyAttendanceConfigEntity> {
    const current = await this.getAttendanceConfig();
    Object.assign(current, {
      late_tolerance_minutes: dto.late_tolerance_minutes ?? current.late_tolerance_minutes,
      alfa_threshold_hours: dto.alfa_threshold_hours ?? current.alfa_threshold_hours,
      objection_window_hours: dto.objection_window_hours ?? current.objection_window_hours,
      check_in_radius_meter: dto.check_in_radius_meter ?? current.check_in_radius_meter,
      office_lat: dto.office_lat !== undefined ? dto.office_lat : current.office_lat,
      office_lng: dto.office_lng !== undefined ? dto.office_lng : current.office_lng,
      effective_date: witaToday(),
      updated_by: adminId,
    });
    return this.attendanceConfigRepo.save(current);
  }

  // ── WhatsApp Status ───────────────────────────────────────────────────────
  async getWhatsappStatus(): Promise<{ connected: boolean; phone: string | null; qr: string | null }> {
    // In a real implementation, this would check the WhatsApp client status
    // For now, return a placeholder structure
    return { connected: false, phone: null, qr: null };
  }

  // ── Backup ────────────────────────────────────────────────────────────────
  async getBackupHistory(limit = 20): Promise<BackupHistoryEntity[]> {
    return this.backupRepo.find({
      order: { started_at: 'DESC' },
      take: limit,
    });
  }

  async triggerManualBackup(userId: string): Promise<BackupHistoryEntity> {
    // Buat record awal dulu, kemudian delegasi ke BackupJob
    const backup = this.backupRepo.create({
      type: 'full',
      status: 'running',
      triggered_by: userId,
      started_at: new Date(),
    });
    const saved = await this.backupRepo.save(backup);

    // Jalankan backup asynchronously (tidak block response)
    if (this.backupJob) {
      this.backupJob['runBackup']('full').catch(() => {});
    }

    return saved;
  }
}
