import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import * as Handlebars from 'handlebars';

import { WarningLetterEntity } from './entities/warning-letter.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AttendanceViolationEntity } from '../attendance/entities/attendance-violation.entity';
import { StorageService } from '../../services/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWarningLetterDto } from './dto/create-warning-letter.dto';

@Injectable()
export class WarningLettersService {
  private readonly logger = new Logger(WarningLettersService.name);

  constructor(
    @InjectRepository(WarningLetterEntity)
    private spRepo: Repository<WarningLetterEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(AttendanceViolationEntity)
    private violationRepo: Repository<AttendanceViolationEntity>,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── List semua SP (admin/HR) ──────────────────────────────────
  async findAll(userId?: string, level?: string): Promise<WarningLetterEntity[]> {
    const qb = this.spRepo.createQueryBuilder('sp')
      .leftJoinAndSelect('sp.user', 'user')
      .leftJoinAndSelect('sp.issuer', 'issuer')
      .orderBy('sp.issued_at', 'DESC');

    if (userId) qb.andWhere('sp.user_id = :userId', { userId });
    if (level) qb.andWhere('sp.level = :level', { level });

    return qb.getMany();
  }

  // ── Riwayat SP satu karyawan ──────────────────────────────────
  async findByUser(userId: string): Promise<WarningLetterEntity[]> {
    return this.spRepo.find({
      where: { user_id: userId },
      relations: ['issuer', 'reference_violation'],
      order: { issued_at: 'DESC' },
    });
  }

  // ── Detail satu SP ────────────────────────────────────────────
  async findOne(id: string): Promise<WarningLetterEntity> {
    const sp = await this.spRepo.findOne({
      where: { id },
      relations: ['user', 'issuer', 'acknowledger', 'reference_violation'],
    });
    if (!sp) throw new NotFoundException('Surat Peringatan tidak ditemukan');
    return sp;
  }

  // ── Buat SP baru ──────────────────────────────────────────────
  async create(dto: CreateWarningLetterDto, issuedBy: string): Promise<WarningLetterEntity> {
    const user = await this.userRepo.findOne({
      where: { id: dto.user_id },
      relations: ['role'],
    });
    if (!user) throw new NotFoundException('Karyawan tidak ditemukan');

    const sp = this.spRepo.create({
      user_id: dto.user_id,
      level: dto.level,
      reason: dto.reason,
      reference_violation_id: dto.reference_violation_id ?? null,
      issued_by: issuedBy,
      issued_at: dto.issued_at ?? new Date().toISOString().split('T')[0],
      valid_until: dto.valid_until ?? null,
      notes: dto.notes ?? null,
    });

    const saved = await this.spRepo.save(sp);

    // Generate PDF async — tidak block response
    this.generateAndUploadPdf(saved.id).catch((e) =>
      this.logger.error(`PDF generation failed for SP ${saved.id}: ${e.message}`),
    );

    // Kirim notif ke karyawan
    try {
      await this.notifications.send({
        userId: user.id,
        title: `Surat Peringatan ${dto.level}`,
        body: `Anda menerima Surat Peringatan ${dto.level}. Silakan buka aplikasi untuk konfirmasi.`,
        type: 'warning',
        data: { warning_letter_id: saved.id, level: dto.level },
      });
    } catch (e) {
      this.logger.warn(`Notifikasi SP gagal dikirim: ${e.message}`);
    }

    return saved;
  }

  // ── Acknowledge (TTD digital karyawan) ───────────────────────
  async acknowledge(id: string, userId: string): Promise<WarningLetterEntity> {
    const sp = await this.findOne(id);

    if (sp.user_id !== userId) {
      throw new BadRequestException('Hanya karyawan yang bersangkutan yang dapat konfirmasi SP ini');
    }

    if (sp.acknowledged_at) {
      throw new BadRequestException('SP ini sudah dikonfirmasi sebelumnya');
    }

    await this.spRepo.update(id, {
      acknowledged_by: userId,
      acknowledged_at: new Date(),
    });

    return this.findOne(id);
  }

  // ── Cek jumlah violations karyawan (untuk SP reminder cron) ──
  async getViolationCountLast30Days(userId: string): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    return this.violationRepo.count({
      where: {
        user_id: userId,
        is_resolved: false,
        created_at: LessThan(new Date()),
      },
    });
  }

  // ── Generate & upload PDF SP ──────────────────────────────────
  async generateAndUploadPdf(spId: string): Promise<string | null> {
    const sp = await this.findOne(spId);

    const templatePath = path.join(__dirname, 'templates', 'warning-letter.hbs');
    if (!fs.existsSync(templatePath)) {
      this.logger.warn('Template SP tidak ditemukan, skip PDF generation');
      return null;
    }

    try {
      const templateSource = fs.readFileSync(templatePath, 'utf-8');
      const template = Handlebars.compile(templateSource);

      const html = template({
        level: sp.level,
        user_name: sp.user?.full_name ?? '—',
        employee_id: (sp.user as any)?.employee_id ?? '—',
        department: (sp.user as any)?.department?.name ?? '—',
        reason: sp.reason,
        issued_at: sp.issued_at,
        valid_until: sp.valid_until ?? 'Tidak ditentukan',
        notes: sp.notes ?? '',
        issuer_name: sp.issuer?.full_name ?? '—',
        generated_at: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' }),
      });

      // Dynamic Puppeteer import to match existing pattern
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
      await browser.close();

      const url = await this.storage.upload(`warning-letters/${sp.id}`, 'pdf', pdfBuffer, 'application/pdf');

      await this.spRepo.update(spId, { doc_url: url });
      return url;
    } catch (e) {
      this.logger.error(`generateAndUploadPdf error: ${e.message}`);
      return null;
    }
  }

  // ── Get PDF URL (generate jika belum ada) ────────────────────
  async getPdfUrl(id: string): Promise<{ url: string }> {
    const sp = await this.findOne(id);

    if (sp.doc_url) return { url: sp.doc_url };

    const url = await this.generateAndUploadPdf(id);
    if (!url) throw new BadRequestException('PDF belum tersedia, coba lagi beberapa saat');
    return { url };
  }
}
