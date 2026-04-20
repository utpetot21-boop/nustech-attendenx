import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ServiceReportEntity } from '../visits/entities/service-report.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { VisitPhotoEntity } from '../visits/entities/visit-photo.entity';
import { StorageService } from '../../services/storage.service';
import { PdfGeneratorService, ServiceReportData } from './pdf-generator.service';
import { CreateServiceReportDto } from './dto/create-service-report.dto';
import { SignClientDto, ClientSignatureType } from './dto/sign-client.dto';

@Injectable()
export class ServiceReportsService {
  constructor(
    @InjectRepository(ServiceReportEntity)
    private readonly reportRepo: Repository<ServiceReportEntity>,
    @InjectRepository(VisitEntity)
    private readonly visitRepo: Repository<VisitEntity>,
    @InjectRepository(VisitPhotoEntity)
    private readonly photoRepo: Repository<VisitPhotoEntity>,
    @InjectDataSource()
    private readonly ds: DataSource,
    private readonly storage: StorageService,
    private readonly pdfGen: PdfGeneratorService,
  ) {}

  // ── Create draft BA ─────────────────────────────────────────────────────────
  async create(userId: string, visitId: string, dto: CreateServiceReportDto): Promise<ServiceReportEntity> {
    const visit = await this.visitRepo.findOne({
      where: { id: visitId },
      relations: ['client', 'user'],
    });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan');
    if (visit.user_id !== userId) throw new ForbiddenException('Bukan kunjungan Anda');
    if (visit.status !== 'completed') throw new BadRequestException('Kunjungan belum selesai');

    // Cek minimum foto terpenuhi
    await this.validateMinPhotos(visitId);

    // Cek sudah ada BA?
    const existing = await this.reportRepo.findOne({ where: { visit_id: visitId } });
    if (existing) return existing;

    const report = this.reportRepo.create({
      visit_id: visitId,
      technician_id: userId,
      client_id: visit.client_id,
      client_pic_name: dto.client_pic_name ?? null,
    });
    return this.reportRepo.save(report);
  }

  // ── Tanda tangan teknisi ─────────────────────────────────────────────────────
  async signTechnician(userId: string, reportId: string, signatureBuffer: Buffer): Promise<ServiceReportEntity> {
    const report = await this.findReportOrThrow(reportId);
    if (report.technician_id !== userId) throw new ForbiddenException('Bukan laporan Anda');
    if (report.is_locked) throw new BadRequestException('Laporan sudah dikunci');

    const url = await this.storage.upload('signatures', 'png', signatureBuffer, 'image/png');
    report.tech_signature_url = url;
    return this.reportRepo.save(report);
  }

  // ── Tanda tangan klien ───────────────────────────────────────────────────────
  async signClient(
    userId: string,
    reportId: string,
    dto: SignClientDto,
    fileBuffer?: Buffer,
  ): Promise<ServiceReportEntity> {
    const report = await this.findReportOrThrow(reportId);
    if (report.technician_id !== userId) throw new ForbiddenException('Bukan laporan Anda');
    if (report.is_locked) throw new BadRequestException('Laporan sudah dikunci');
    if (!report.tech_signature_url) {
      throw new BadRequestException('Teknisi harus tanda tangan lebih dulu');
    }

    let signatureUrl: string;

    if (dto.signature_type === ClientSignatureType.DIGITAL) {
      if (!dto.signature_base64) throw new BadRequestException('signature_base64 wajib untuk tipe digital');
      const buf = Buffer.from(dto.signature_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      signatureUrl = await this.storage.upload('signatures', 'png', buf, 'image/png');
    } else {
      if (!fileBuffer) throw new BadRequestException('File tanda tangan wajib untuk tipe photo_upload');
      signatureUrl = await this.storage.upload('signatures', 'jpg', fileBuffer, 'image/jpeg');
    }

    report.client_signature_url = signatureUrl;
    report.client_signature_type = dto.signature_type;
    report.client_pic_name = dto.client_pic_name;
    report.signed_at = new Date();

    // Kedua TTD lengkap → kunci dan generate PDF otomatis
    report.is_locked = true;
    const saved = await this.reportRepo.save(report);

    // Generate PDF async (tidak block response)
    this.generateAndStorePdf(saved.id).catch((e) =>
      console.error('PDF generation error for', saved.id, e),
    );

    return saved;
  }

  // ── Generate PDF manual (re-generate) ───────────────────────────────────────
  async generatePdf(userId: string, reportId: string, role: string): Promise<Buffer> {
    const report = await this.findReportOrThrow(reportId);

    // Teknisi atau admin/manager boleh download
    if (role === 'karyawan' && report.technician_id !== userId) {
      throw new ForbiddenException('Bukan laporan Anda');
    }

    // Kalau sudah pernah digenerate, ambil langsung dari R2 — tidak perlu Puppeteer lagi
    if (report.pdf_url) {
      try {
        const res = await fetch(report.pdf_url, { signal: AbortSignal.timeout(15_000) });
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      } catch {
        // R2 fetch gagal → fallthrough ke regenerate
      }
    }

    return this.generateAndStorePdf(reportId);
  }

  // ── List laporan (admin/manager) ─────────────────────────────────────────────
  async findAll(filters: { month?: string; userId?: string; clientId?: string }) {
    const qb = this.reportRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.visit', 'v')
      .leftJoinAndSelect('sr.technician', 'tech')
      .leftJoinAndSelect('sr.client', 'client')
      .orderBy('sr.created_at', 'DESC');

    if (filters.month) {
      const [y, m] = filters.month.split('-').map(Number);
      qb.andWhere('EXTRACT(YEAR FROM sr.created_at) = :y', { y });
      qb.andWhere('EXTRACT(MONTH FROM sr.created_at) = :m', { m });
    }
    if (filters.userId) qb.andWhere('sr.technician_id = :uid', { uid: filters.userId });
    if (filters.clientId) qb.andWhere('sr.client_id = :cid', { cid: filters.clientId });

    return qb.getMany();
  }

  // ── List milik teknisi ────────────────────────────────────────────────────────
  async findMine(userId: string, month?: string) {
    const qb = this.reportRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.visit', 'v')
      .leftJoinAndSelect('sr.client', 'client')
      .where('sr.technician_id = :uid', { uid: userId })
      .orderBy('sr.created_at', 'DESC');

    if (month) {
      const [y, m] = month.split('-').map(Number);
      qb.andWhere('EXTRACT(YEAR FROM sr.created_at) = :y', { y });
      qb.andWhere('EXTRACT(MONTH FROM sr.created_at) = :m', { m });
    }

    return qb.getMany();
  }

  // ── Detail BA ─────────────────────────────────────────────────────────────────
  async findOne(id: string): Promise<ServiceReportEntity> {
    return this.findReportOrThrow(id);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────────

  private async findReportOrThrow(id: string): Promise<ServiceReportEntity> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: ['visit', 'visit.client', 'visit.user', 'technician', 'client'],
    });
    if (!report) throw new NotFoundException('Berita Acara tidak ditemukan');
    return report;
  }

  private async validateMinPhotos(visitId: string): Promise<void> {
    const counts = await this.photoRepo
      .createQueryBuilder('p')
      .select('p.phase', 'phase')
      .addSelect('COUNT(*)', 'cnt')
      .where('p.visit_id = :id', { id: visitId })
      .groupBy('p.phase')
      .getRawMany<{ phase: string; cnt: string }>();

    const map: Record<string, number> = {};
    for (const row of counts) map[row.phase] = parseInt(row.cnt);

    const mins: Record<string, number> = { before: 5, during: 6, after: 5 };
    for (const [phase, min] of Object.entries(mins)) {
      if ((map[phase] ?? 0) < min) {
        throw new BadRequestException(
          `Foto ${phase} belum cukup. Minimal ${min}, tersedia ${map[phase] ?? 0}`,
        );
      }
    }
  }

  private async generateReportNumber(reportId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Thread-safe sequence increment using advisory lock
    const result = await this.ds.query<{ seq: number }[]>(
      `INSERT INTO report_sequences (year, month, seq, updated_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (year, month) DO UPDATE
         SET seq = report_sequences.seq + 1, updated_at = NOW()
       RETURNING seq`,
      [year, month],
    );

    const seq = result[0]?.seq ?? 1;
    const number = `BA-${year}/${String(month).padStart(2, '0')}/${String(seq).padStart(3, '0')}`;

    // Persist to entity
    await this.reportRepo.update(reportId, { report_number: number });
    return number;
  }

  private async generateAndStorePdf(reportId: string): Promise<Buffer> {
    const report = await this.findReportOrThrow(reportId);

    // Generate nomor jika belum ada
    let reportNumber = report.report_number;
    if (!reportNumber) {
      reportNumber = await this.generateReportNumber(reportId);
    }

    // Ambil foto per fase
    const photos = await this.photoRepo.find({
      where: { visit_id: report.visit_id },
      order: { phase: 'ASC', created_at: 'ASC' },
    });

    // Pakai thumbnail_url (jauh lebih kecil) agar base64 pre-fetch cepat
    const byPhase = (phase: string) =>
      photos
        .filter((p) => p.phase === phase)
        .map((p) => ({ url: p.thumbnail_url ?? p.watermarked_url ?? p.original_url, caption: p.caption ?? '' }));

    const visit = report.visit;
    const durationMin = visit.duration_minutes ?? 0;
    const durationText =
      durationMin >= 60
        ? `${Math.floor(durationMin / 60)} jam ${durationMin % 60} menit`
        : `${durationMin} menit`;

    const fmtWita = (d: Date | null) =>
      d
        ? new Date(d).toLocaleString('id-ID', {
            timeZone: 'Asia/Makassar',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) + ' WITA'
        : '—';

    const data: ServiceReportData = {
      report_number: reportNumber,
      created_at_fmt: fmtWita(report.created_at),
      printed_at: fmtWita(new Date()),
      technician_name: report.technician?.full_name ?? '—',
      client_name: report.client?.name ?? '—',
      client_pic_name: report.client_pic_name ?? '—',
      check_in_at_fmt: fmtWita(visit.check_in_at),
      check_out_at_fmt: fmtWita(visit.check_out_at),
      duration_text: durationText,
      check_in_address: visit.check_in_address ?? '—',
      check_in_lat: visit.check_in_lat?.toString() ?? '—',
      check_in_lng: visit.check_in_lng?.toString() ?? '—',
      gps_valid: visit.gps_valid,
      work_description: visit.work_description ?? '—',
      findings: visit.findings ?? '',
      recommendations: visit.recommendations ?? '',
      materials_used: (visit.materials_used as any[]) ?? [],
      before_photos: byPhase('before'),
      during_photos: byPhase('during'),
      after_photos: byPhase('after'),
      tech_signature_url: report.tech_signature_url,
      client_signature_url: report.client_signature_url,
      is_locked: report.is_locked,
    };

    const pdfBuffer = await this.pdfGen.generate(data);

    // Upload ke storage
    const pdfUrl = await this.storage.upload('service-reports', 'pdf', pdfBuffer, 'application/pdf');

    // Simpan URL ke DB
    await this.reportRepo.update(reportId, {
      pdf_url: pdfUrl,
      pdf_generated_at: new Date(),
    });

    return pdfBuffer;
  }
}
