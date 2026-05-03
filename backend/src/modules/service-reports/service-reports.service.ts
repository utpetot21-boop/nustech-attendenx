import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { ServiceReportEntity } from '../visits/entities/service-report.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { VisitPhotoEntity } from '../visits/entities/visit-photo.entity';
import { StorageService } from '../../services/storage.service';
import { PdfGeneratorService, ServiceReportData } from './pdf-generator.service';
import { CreateServiceReportDto } from './dto/create-service-report.dto';
import { SignClientDto, ClientSignatureType } from './dto/sign-client.dto';
import { EmailService } from '../notifications/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompanyProfileEntity } from '../settings/entities/company-profile.entity';
import { TemplatePhotoRequirementEntity } from '../templates/entities/template-photo-requirement.entity';

@Injectable()
export class ServiceReportsService {
  constructor(
    @InjectRepository(ServiceReportEntity)
    private readonly reportRepo: Repository<ServiceReportEntity>,
    @InjectRepository(VisitEntity)
    private readonly visitRepo: Repository<VisitEntity>,
    @InjectRepository(VisitPhotoEntity)
    private readonly photoRepo: Repository<VisitPhotoEntity>,
    @InjectRepository(CompanyProfileEntity)
    private readonly companyRepo: Repository<CompanyProfileEntity>,
    @InjectDataSource()
    private readonly ds: DataSource,
    private readonly storage: StorageService,
    private readonly pdfGen: PdfGeneratorService,
    private readonly email: EmailService,
    private readonly jwtService: JwtService,
    private readonly notifService: NotificationsService,
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

    // Notif ke teknisi
    this.notifService.send({
      userId: saved.technician_id,
      type: 'ba_generated',
      title: 'Berita Acara Selesai',
      body: 'BA telah ditandatangani klien dan siap diunduh.',
      data: { report_id: saved.id },
    }).catch(() => {});
    // FYI ke manager/admin
    this.notifService.getFyiViewerIds([saved.technician_id]).then((fyi) =>
      this.notifService.sendMany(fyi, 'ba_generated',
        'BA Selesai',
        `Teknisi ${saved.technician?.full_name ?? ''} — BA terkunci.`,
        { report_id: saved.id },
      ),
    ).catch(() => {});

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

  // ── Kirim BA ke klien via email ───────────────────────────────────────────────
  async sendToClient(reportId: string, requesterId: string): Promise<{ success: boolean; sent_to: string }> {
    const report = await this.findReportOrThrow(reportId);

    if (!report.is_locked) throw new BadRequestException('BA belum ditandatangani — tidak bisa dikirim');
    if (!report.pdf_url) throw new BadRequestException('PDF belum ter-generate — coba download PDF terlebih dahulu');

    const clientEmail = report.client?.pic_email;
    if (!clientEmail) throw new BadRequestException('Email PIC klien tidak ditemukan pada data klien');

    // Ambil PDF buffer dari R2
    let pdfBuffer: Buffer;
    try {
      const res = await fetch(report.pdf_url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pdfBuffer = Buffer.from(await res.arrayBuffer());
    } catch {
      pdfBuffer = await this.generateAndStorePdf(reportId);
    }

    const company = await this.companyRepo.findOne({ where: {} });
    const companyName = company?.name ?? 'Nustech';

    const reportNum = report.report_number ?? reportId;
    const techName = report.technician?.full_name ?? '—';
    const clientName = report.client?.name ?? '—';
    const picName = report.client_pic_name ?? report.client?.pic_name ?? '—';
    const signedAt = report.signed_at
      ? new Date(report.signed_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'long', timeStyle: 'short' }) + ' WITA'
      : '—';

    const html = `
<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f5f7fa;margin:0;padding:24px}
  .card{background:#fff;border-radius:8px;padding:32px;max-width:560px;margin:0 auto;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  h2{color:#1a56db;font-size:18px;margin:0 0 4px}
  .sub{color:#666;font-size:13px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{padding:6px 0;vertical-align:top}
  td:first-child{color:#555;width:45%}
  .footer{margin-top:24px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:12px}
  .badge{display:inline-block;background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700}
</style></head><body>
<div class="card">
  <h2>Berita Acara Kunjungan Teknis</h2>
  <div class="sub">Dokumen ini dikirimkan secara otomatis oleh sistem ${companyName}</div>
  <table>
    <tr><td>Nomor BA</td><td><strong>${reportNum}</strong></td></tr>
    <tr><td>Klien</td><td>${clientName}</td></tr>
    <tr><td>PIC</td><td>${picName}</td></tr>
    <tr><td>Teknisi</td><td>${techName}</td></tr>
    <tr><td>Tanggal TTD</td><td>${signedAt}</td></tr>
    <tr><td>Status</td><td><span class="badge">✓ Selesai &amp; Terkunci</span></td></tr>
  </table>
  <p style="margin-top:20px;font-size:13px;color:#374151">
    Berita Acara terlampir dalam format PDF. Mohon simpan dokumen ini sebagai bukti pelaksanaan kunjungan.
  </p>
  <div class="footer">
    ${companyName}<br>
    Email ini dikirim secara otomatis, tidak perlu membalas.
  </div>
</div>
</body></html>`;

    await this.email.sendEmail(
      clientEmail,
      `Berita Acara Kunjungan — ${reportNum}`,
      html,
      [{ filename: `${reportNum.replace(/\//g, '-')}.pdf`, content: pdfBuffer.toString('base64') }],
    );

    await this.reportRepo.update(reportId, { sent_to_client: true, sent_at: new Date() });

    this.notifService.send({
      userId: report.technician_id,
      type: 'ba_sent_to_client',
      title: 'BA Terkirim ke Klien',
      body: 'Berita Acara berhasil dikirim ke email klien.',
      data: { report_id: reportId },
    }).catch(() => {});

    return { success: true, sent_to: clientEmail };
  }

  // ── Generate short-lived PDF token (10 menit) ────────────────────────────────
  async generatePdfToken(userId: string, reportId: string): Promise<string> {
    const report = await this.findReportOrThrow(reportId);
    if (!report.is_locked) throw new BadRequestException('BA belum dikunci — PDF belum tersedia');
    return this.jwtService.sign(
      { sub: userId, reportId, type: 'pdf_token' },
      { expiresIn: '10m' },
    );
  }

  // ── Generate PDF menggunakan short-lived token (untuk pdf-view endpoint) ──────
  async generatePdfWithToken(token: string, reportId: string): Promise<Buffer> {
    let payload: { sub: string; reportId: string; type: string };
    try {
      payload = this.jwtService.verify<{ sub: string; reportId: string; type: string }>(token);
    } catch {
      throw new ForbiddenException('Token tidak valid atau sudah kadaluarsa');
    }
    if (payload.type !== 'pdf_token' || payload.reportId !== reportId) {
      throw new ForbiddenException('Token tidak valid untuk laporan ini');
    }
    return this.generatePdf(payload.sub, reportId, 'karyawan');
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

    // Ambil foto dengan join requirement untuk ordering by template
    const photos = await this.photoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.photo_requirement', 'pr')
      .where('p.visit_id = :vid', { vid: report.visit_id })
      .orderBy('pr.order_index', 'ASC', 'NULLS LAST')
      .addOrderBy('p.seq_number', 'ASC', 'NULLS LAST')
      .addOrderBy('p.created_at', 'ASC')
      .getMany();

    // Ambil daftar requirements untuk template ini
    const photoRequirements = report.visit.template_id
      ? await this.ds.getRepository(TemplatePhotoRequirementEntity).find({
          where: { template_id: report.visit.template_id },
          order: { order_index: 'ASC' },
        })
      : [];

    const has_requirements = photoRequirements.length > 0;

    const requirement_photos = photoRequirements
      .map((req) => ({
        label: req.label,
        phase: req.phase,
        photos: photos
          .filter((p) => p.photo_requirement_id === req.id)
          .map((p) => ({ url: p.watermarked_url ?? p.thumbnail_url ?? p.original_url, caption: p.caption ?? '' })),
      }))
      .filter((r) => r.photos.length > 0);

    // Ambil form sections + field responses (semua field template, nilai diisi jika ada jawaban)
    const rawFormRows = report.visit.template_id
      ? await this.ds.query<{
          section_title: string;
          section_order: number;
          field_label: string;
          field_type: string;
          is_required: boolean;
          field_order: number;
          value: string | null;
        }[]>(
          `SELECT ts.title AS section_title, ts.order_index AS section_order,
                  tf.label AS field_label, tf.field_type, tf.is_required,
                  tf.order_index AS field_order, vfr.value
           FROM template_sections ts
           JOIN template_fields tf ON tf.section_id = ts.id
           LEFT JOIN visit_form_responses vfr
             ON vfr.field_id = tf.id AND vfr.visit_id = $1
           WHERE ts.template_id = $2
           ORDER BY ts.order_index ASC, tf.order_index ASC`,
          [report.visit_id, report.visit.template_id],
        )
      : [];

    const formSections = rawFormRows.reduce<
      Array<{ title: string; fields: Array<{ label: string; field_type: string; value: string; is_required: boolean }> }>
    >((acc, row) => {
      let section = acc.find((s) => s.title === row.section_title);
      if (!section) {
        section = { title: row.section_title, fields: [] };
        acc.push(section);
      }
      section.fields.push({
        label: row.field_label,
        field_type: row.field_type,
        value: row.value ?? '',
        is_required: row.is_required,
      });
      return acc;
    }, []);

    // Ambil profil perusahaan untuk header PDF
    const company = await this.companyRepo.findOne({ where: {} });

    // Pakai thumbnail_url (jauh lebih kecil) agar base64 pre-fetch cepat
    const byPhase = (phase: string) =>
      photos
        .filter((p) => p.phase === phase)
        .map((p) => ({ url: p.watermarked_url ?? p.thumbnail_url ?? p.original_url, caption: p.caption ?? '' }));

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
      form_sections: formSections,
      before_photos: byPhase('before'),
      during_photos: byPhase('during'),
      after_photos: byPhase('after'),
      has_requirements,
      requirement_photos,
      tech_signature_url: report.tech_signature_url,
      client_signature_url: report.client_signature_url,
      is_locked: report.is_locked,
      company_name: company?.name ?? 'Nustech',
      company_address: company?.address ?? '',
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
