import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { VisitEntity } from './entities/visit.entity';
import { VisitPhotoEntity } from './entities/visit-photo.entity';
import { SlaBreachEntity } from './entities/sla-breach.entity';
import { CheckInVisitDto } from './dto/check-in-visit.dto';
import { AddPhotoDto } from './dto/add-photo.dto';
import { CheckOutVisitDto } from './dto/check-out-visit.dto';
import { UpdateVisitReportDto } from './dto/update-visit-report.dto';
import { FormResponseItemDto } from './dto/save-form-responses.dto';
import { GivePhotoFeedbackDto } from './dto/give-photo-feedback.dto';
import { AdminUpdateVisitDto } from './dto/admin-update-visit.dto';
import sharp from 'sharp';
import { NominatimService } from '../../services/nominatim.service';
import { StorageService } from '../../services/storage.service';
import { ClientEntity } from '../clients/entities/client.entity';
import { VisitFormResponseEntity } from '../templates/entities/visit-form-response.entity';
import { TemplatePhotoRequirementEntity } from '../templates/entities/template-photo-requirement.entity';
import { TaskEntity } from '../tasks/entities/task.entity';
import { TaskHoldEntity } from '../tasks/entities/task-hold.entity';
import { ReviewVisitDto } from './dto/review-visit.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogEntity } from '../audit/entities/audit-log.entity';

// Photo phase limits (min / max)
const PHOTO_LIMITS: Record<string, { min: number; max: number }> = {
  before: { min: 5, max: 20 },
  during: { min: 6, max: 20 },
  after: { min: 5, max: 20 },
};

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(VisitEntity)
    private readonly visitRepo: Repository<VisitEntity>,
    @InjectRepository(VisitPhotoEntity)
    private readonly photoRepo: Repository<VisitPhotoEntity>,
    @InjectRepository(SlaBreachEntity)
    private readonly slaBreachRepo: Repository<SlaBreachEntity>,
    @InjectRepository(ClientEntity)
    private readonly clientRepo: Repository<ClientEntity>,
    @InjectRepository(VisitFormResponseEntity)
    private readonly formResponseRepo: Repository<VisitFormResponseEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TaskHoldEntity)
    private readonly holdRepo: Repository<TaskHoldEntity>,
    @InjectRepository(TemplatePhotoRequirementEntity)
    private readonly photoReqRepo: Repository<TemplatePhotoRequirementEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
    private readonly nominatim: NominatimService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  // CHECK-IN
  // ────────────────────────────────────────────────────────────────────────────
  async checkIn(userId: string, dto: CheckInVisitDto): Promise<VisitEntity> {
    // task_id WAJIB ada
    if (!dto.task_id) {
      throw new BadRequestException('task_id wajib diisi untuk kunjungan lapangan.');
    }

    // Pastikan tidak ada kunjungan ongoing yang belum selesai
    const existing = await this.visitRepo.findOne({
      where: { user_id: userId, status: 'ongoing' },
    });
    if (existing) {
      throw new BadRequestException(
        'Terdapat kunjungan yang sedang berlangsung. Selesaikan terlebih dahulu.',
      );
    }

    // Validasi task: harus ada, statusnya in_progress/assigned, dan ditugaskan ke user ini
    let taskTemplateId: string | null = null;
    if (dto.task_id) {
      const task = await this.taskRepo.findOne({ where: { id: dto.task_id } });
      if (!task) throw new NotFoundException('Tugas tidak ditemukan.');
      if (!['assigned', 'in_progress'].includes(task.status)) {
        throw new BadRequestException('Tugas ini tidak dalam status yang dapat dikunjungi.');
      }
      if (task.assigned_to && task.assigned_to !== userId) {
        throw new ForbiddenException('Anda tidak memiliki izin untuk melakukan check-in pada tugas ini.');
      }
      taskTemplateId = task.template_id ?? null;
    }

    // Validasi client
    const client = await this.clientRepo.findOne({ where: { id: dto.client_id } });
    if (!client) throw new NotFoundException('Client tidak ditemukan.');

    // Hitung jarak GPS dari client
    const deviationMeter = this.haversineMeters(
      dto.lat,
      dto.lng,
      Number(client.lat),
      Number(client.lng),
    );
    const gpsValid = deviationMeter <= client.radius_meter;

    // Reverse geocode
    const geo = await this.nominatim.reverse(dto.lat, dto.lng);

    const visit = this.visitRepo.create({
      task_id: dto.task_id,
      template_id: taskTemplateId,
      user_id: userId,
      client_id: dto.client_id,
      check_in_at: new Date(),
      check_in_lat: dto.lat,
      check_in_lng: dto.lng,
      check_in_address: geo.address,
      check_in_district: geo.district,
      check_in_province: geo.province,
      gps_valid: gpsValid,
      gps_deviation_meter: Math.round(deviationMeter),
      status: 'ongoing',
    });

    const saved = await this.visitRepo.save(visit);

    // Sinkronkan status task: assigned → in_progress agar task tidak lagi muncul
    // sebagai "Siap Dikerjakan" di mobile Pekerjaan.
    await this.taskRepo.update(
      { id: dto.task_id, status: 'assigned' },
      { status: 'in_progress' },
    );

    return saved;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ADD PHOTO
  // ────────────────────────────────────────────────────────────────────────────
  async addPhoto(
    userId: string,
    visitId: string,
    dto: AddPhotoDto,
    fileBuffer: Buffer,
  ): Promise<VisitPhotoEntity> {
    await this.getOngoingVisit(userId, visitId);

    // Validasi batas foto — per requirement jika dikirim, fallback ke phase global
    if (dto.requirement_id) {
      const req = await this.photoReqRepo.findOne({ where: { id: dto.requirement_id } });
      if (!req) throw new BadRequestException('Requirement foto tidak ditemukan.');
      const reqCount = await this.photoRepo.count({
        where: { visit_id: visitId, photo_requirement_id: dto.requirement_id },
      });
      if (reqCount >= req.max_photos) {
        throw new BadRequestException(
          `"${req.label}" sudah mencapai batas maksimum ${req.max_photos} foto.`,
        );
      }
    } else {
      const phaseCount = await this.photoRepo.count({
        where: { visit_id: visitId, phase: dto.phase },
      });
      const limits = PHOTO_LIMITS[dto.phase];
      if (phaseCount >= limits.max) {
        throw new BadRequestException(
          `Fase "${dto.phase}" sudah mencapai batas maksimum ${limits.max} foto.`,
        );
      }
    }

    // Reverse geocode photo location (skip jika tidak ada GPS — foto dari galeri)
    const hasGps = dto.lat !== 0 || dto.lng !== 0;
    const geo = hasGps
      ? await this.nominatim.reverse(dto.lat, dto.lng)
      : { address: null, district: null, province: null };

    // Gunakan taken_at dari client jika ada (offline queue), else waktu server
    const takenAt = dto.taken_at ? new Date(dto.taken_at) : new Date();
    const source = dto.source ?? 'camera';

    const originalBuffer = await sharp(fileBuffer)
      .rotate()
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize({ width: 400 })
      .jpeg({ quality: 75 })
      .toBuffer();
    const fileSizeKb = Math.ceil(originalBuffer.length / 1024);

    const folder = `visits/${visitId}/${dto.phase}`;
    const [originalUrl, thumbnailUrl] = await Promise.all([
      this.storage.upload(`${folder}/original`, 'jpg', originalBuffer),
      this.storage.upload(`${folder}/thumbnail`, 'jpg', thumbnailBuffer),
    ]);

    const seqCount = await this.photoRepo.count({ where: { visit_id: visitId, phase: dto.phase } });
    const photo = this.photoRepo.create({
      visit_id: visitId,
      phase: dto.phase,
      seq_number: seqCount + 1,
      original_url: originalUrl,
      watermarked_url: originalUrl,
      thumbnail_url: thumbnailUrl,
      caption: dto.caption ?? null,
      taken_at: takenAt,
      lat: hasGps ? dto.lat : null,
      lng: hasGps ? dto.lng : null,
      district: geo.district ?? null,
      province: geo.province ?? null,
      file_size_kb: fileSizeKb,
      photo_requirement_id: dto.requirement_id ?? null,
      source,
    });

    return this.photoRepo.save(photo);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ADD PHOTO — ADMIN (dokumentasi tambahan, tidak perlu visit ongoing)
  // ────────────────────────────────────────────────────────────────────────────
  async addAdminPhoto(
    _adminId: string,
    visitId: string,
    fileBuffer: Buffer,
  ): Promise<VisitPhotoEntity> {
    const visit = await this.visitRepo.findOne({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan.');

    const takenAt = new Date();

    const originalBuffer = await sharp(fileBuffer)
      .rotate()
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize({ width: 400 })
      .jpeg({ quality: 75 })
      .toBuffer();
    const fileSizeKb = Math.ceil(originalBuffer.length / 1024);

    const folder = `visits/${visitId}/extra`;
    const [originalUrl, thumbnailUrl] = await Promise.all([
      this.storage.upload(`${folder}/original`, 'jpg', originalBuffer),
      this.storage.upload(`${folder}/thumbnail`, 'jpg', thumbnailBuffer),
    ]);

    const seqCount = await this.photoRepo.count({ where: { visit_id: visitId, phase: 'extra' } });
    const photo = this.photoRepo.create({
      visit_id: visitId,
      phase: 'extra',
      seq_number: seqCount + 1,
      original_url: originalUrl,
      watermarked_url: originalUrl,
      thumbnail_url: thumbnailUrl,
      caption: null,
      taken_at: takenAt,
      lat: null,
      lng: null,
      district: null,
      province: null,
      file_size_kb: fileSizeKb,
      photo_requirement_id: null,
      source: 'admin',
    });

    return this.photoRepo.save(photo);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CHECK-OUT
  // ────────────────────────────────────────────────────────────────────────────
  async checkOut(
    userId: string,
    visitId: string,
    dto: CheckOutVisitDto,
  ): Promise<VisitEntity> {
    const visit = await this.getOngoingVisit(userId, visitId);

    // Validasi foto — per requirement jika template ada, fallback ke phase global
    const photoReqs = visit.template_id
      ? await this.photoReqRepo.find({ where: { template_id: visit.template_id } })
      : [];

    if (photoReqs.length > 0) {
      for (const req of photoReqs.filter((r) => r.is_required)) {
        const cnt = await this.photoRepo.count({ where: { visit_id: visitId, photo_requirement_id: req.id } });
        if (cnt === 0) {
          throw new BadRequestException(`Foto "${req.label}" wajib diisi sebelum check-out.`);
        }
      }
    } else {
      const [beforeCount, duringCount, afterCount] = await Promise.all([
        this.photoRepo.count({ where: { visit_id: visitId, phase: 'before' } }),
        this.photoRepo.count({ where: { visit_id: visitId, phase: 'during' } }),
        this.photoRepo.count({ where: { visit_id: visitId, phase: 'after' } }),
      ]);
      if (beforeCount < PHOTO_LIMITS.before.min)
        throw new BadRequestException(`Foto fase "before" belum cukup. Minimal ${PHOTO_LIMITS.before.min} foto, saat ini ${beforeCount}.`);
      if (duringCount < PHOTO_LIMITS.during.min)
        throw new BadRequestException(`Foto fase "during" belum cukup. Minimal ${PHOTO_LIMITS.during.min} foto, saat ini ${duringCount}.`);
      if (afterCount < PHOTO_LIMITS.after.min)
        throw new BadRequestException(`Foto fase "after" belum cukup. Minimal ${PHOTO_LIMITS.after.min} foto, saat ini ${afterCount}.`);
    }

    // Validasi required form fields jika visit punya template
    if (visit.template_id) {
      const missing = await this.formResponseRepo.manager.query<{ count: string }[]>(
        `SELECT COUNT(*) AS count
         FROM template_fields tf
         JOIN template_sections ts ON tf.section_id = ts.id
         WHERE ts.template_id = $1
           AND tf.is_required = true
           AND NOT EXISTS (
             SELECT 1 FROM visit_form_responses vfr
             WHERE vfr.visit_id = $2
               AND vfr.field_id = tf.id
               AND vfr.value IS NOT NULL
               AND vfr.value <> ''
           )`,
        [visit.template_id, visitId],
      );
      if (parseInt(missing[0].count) > 0) {
        throw new BadRequestException(
          `Semua field wajib pada formulir kunjungan harus diisi sebelum check-out.`,
        );
      }
    }

    const checkOutAt = new Date();
    const durationMinutes = visit.check_in_at
      ? Math.round((checkOutAt.getTime() - visit.check_in_at.getTime()) / 60000)
      : null;

    visit.check_out_at = checkOutAt;
    visit.work_description = dto.work_description;
    visit.findings = dto.findings ?? null;
    visit.recommendations = dto.recommendations ?? null;
    visit.materials_used = (dto.materials_used as Record<string, unknown>[] | undefined) ?? null;
    visit.duration_minutes = durationMinutes;
    visit.status = 'completed';

    const saved = await this.visitRepo.save(visit);

    // Sinkronkan task: status → completed + completed_at agar pekerjaan hilang
    // dari daftar aktif dan pindah ke riwayat "Selesai".
    if (saved.task_id) {
      await this.taskRepo.update(
        { id: saved.task_id },
        { status: 'completed', completed_at: checkOutAt },
      );
    }

    // SLA breach detection
    await this.checkSlaBreaches(saved);

    return saved;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // HISTORY & DETAIL
  // ────────────────────────────────────────────────────────────────────────────
  async getMyVisits(
    userId: string,
    filters: { page?: number; limit?: number; status?: string },
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.visitRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.client', 'c')
      .where('v.user_id = :userId', { userId })
      .orderBy('v.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) {
      qb.andWhere('v.status = :status', { status: filters.status });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async getVisitDetail(userId: string, visitId: string): Promise<VisitEntity> {
    const visit = await this.visitRepo.findOne({
      where: { id: visitId, user_id: userId },
      relations: ['client', 'photos'],
      order: { photos: { seq_number: 'ASC' } },
    });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan.');
    return visit;
  }

  async getPhotoCounts(visitId: string): Promise<{
    has_requirements: boolean;
    requirements: Array<{ id: string; label: string; phase: string; max_photos: number; is_required: boolean; count: number }>;
    before: { count: number; min: number; max: number };
    during: { count: number; min: number; max: number };
    after: { count: number; min: number; max: number };
  }> {
    const visit = await this.visitRepo.findOne({ where: { id: visitId }, select: ['template_id'] });
    const [b, d, a] = await Promise.all([
      this.photoRepo.count({ where: { visit_id: visitId, phase: 'before' } }),
      this.photoRepo.count({ where: { visit_id: visitId, phase: 'during' } }),
      this.photoRepo.count({ where: { visit_id: visitId, phase: 'after' } }),
    ]);
    const phaseTotals = {
      before: { count: b, ...PHOTO_LIMITS.before },
      during: { count: d, ...PHOTO_LIMITS.during },
      after: { count: a, ...PHOTO_LIMITS.after },
    };

    if (!visit?.template_id) {
      return { has_requirements: false, requirements: [], ...phaseTotals };
    }

    const reqs = await this.photoReqRepo.find({
      where: { template_id: visit.template_id },
      order: { order_index: 'ASC' },
    });
    if (reqs.length === 0) {
      return { has_requirements: false, requirements: [], ...phaseTotals };
    }

    const requirements = await Promise.all(
      reqs.map(async (r) => ({
        id: r.id,
        label: r.label,
        phase: r.phase,
        max_photos: r.max_photos,
        is_required: r.is_required,
        count: await this.photoRepo.count({ where: { visit_id: visitId, photo_requirement_id: r.id } }),
      })),
    );

    return { has_requirements: true, requirements, ...phaseTotals };
  }

  async findAll(filters: { status?: string; userId?: string; clientId?: string; date?: string; reviewStatus?: string; page?: number; limit?: number }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const qb = this.visitRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'u')
      .leftJoinAndSelect('v.client', 'c')
      .leftJoinAndSelect('v.photos', 'p')
      .leftJoinAndSelect('v.service_report', 'sr')
      .orderBy('v.created_at', 'DESC')
      .addOrderBy('p.seq_number', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) qb.andWhere('v.status = :status', { status: filters.status });
    if (filters.userId) qb.andWhere('v.user_id = :userId', { userId: filters.userId });
    if (filters.clientId) qb.andWhere('v.client_id = :clientId', { clientId: filters.clientId });
    if (filters.date) qb.andWhere('DATE(v.check_in_at) = :date', { date: filters.date });
    if (filters.reviewStatus === 'unreviewed') {
      qb.andWhere('v.review_status IS NULL').andWhere('v.status = :completedStatus', { completedStatus: 'completed' });
    } else if (filters.reviewStatus) {
      qb.andWhere('v.review_status = :reviewStatus', { reviewStatus: filters.reviewStatus });
    }

    const [items, total] = await qb.getManyAndCount();

    // Attach latest hold record for on-hold visits so HRD can see reason/reschedule info
    const onHoldVisitIds = items.filter((v) => v.status === 'on_hold').map((v) => v.id);
    const holdMap = new Map<string, TaskHoldEntity>();
    if (onHoldVisitIds.length > 0) {
      const holds = await this.holdRepo.find({
        where: { visit_id: In(onHoldVisitIds) },
        relations: ['holder'],
        order: { created_at: 'DESC' },
      });
      holds.forEach((h) => {
        if (h.visit_id && !holdMap.has(h.visit_id)) holdMap.set(h.visit_id, h);
      });
    }
    const enrichedItems = items.map((v) => ({ ...v, hold_detail: holdMap.get(v.id) ?? null }));

    return { items: enrichedItems, total, page, limit };
  }

  async getAdminDetail(visitId: string): Promise<VisitEntity> {
    const visit = await this.visitRepo.findOne({
      where: { id: visitId },
      relations: ['client', 'photos', 'user', 'service_report', 'reviewer'],
      order: { photos: { seq_number: 'ASC' } },
    });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan.');
    return visit;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // REVIEW / EVALUASI
  // ────────────────────────────────────────────────────────────────────────────
  async reviewVisit(adminId: string, visitId: string, dto: ReviewVisitDto): Promise<VisitEntity> {
    const visit = await this.visitRepo.findOne({
      where: { id: visitId },
      relations: ['user'],
    });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan.');
    if (visit.status !== 'completed') {
      throw new BadRequestException('Hanya kunjungan berstatus "Selesai" yang dapat direview.');
    }

    visit.review_status = dto.review_status;
    visit.review_rating = dto.review_rating;
    visit.review_notes = dto.review_notes ?? null;
    visit.reviewed_by = adminId;
    visit.reviewed_at = new Date();

    const saved = await this.visitRepo.save(visit);

    const isApproved = dto.review_status === 'approved';
    const ratingStr = '⭐'.repeat(dto.review_rating);
    await this.notifications.send({
      userId: visit.user_id,
      type: 'visit_reviewed',
      title: isApproved ? '✅ Laporan Kunjungan Disetujui' : '⚠️ Laporan Kunjungan Perlu Revisi',
      body: dto.review_notes
        ? `${ratingStr} — ${dto.review_notes}`
        : `${ratingStr} — Laporan kunjungan Anda telah dievaluasi.`,
      data: { visit_id: visitId, type: 'visit_reviewed', review_status: dto.review_status },
      channels: ['push'],
    });

    return saved;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────────────────────────────────
  private async getOngoingVisit(userId: string, visitId: string): Promise<VisitEntity> {
    const visit = await this.visitRepo.findOne({ where: { id: visitId, user_id: userId } });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan.');
    if (visit.status !== 'ongoing') {
      throw new ForbiddenException('Kunjungan sudah selesai atau ditahan.');
    }
    return visit;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SLA BREACH DETECTION
  // ────────────────────────────────────────────────────────────────────────────
  private async checkSlaBreaches(visit: VisitEntity): Promise<void> {
    if (!visit.client_id) return;
    const client = await this.clientRepo.findOne({ where: { id: visit.client_id } });
    if (!client) return;

    const checkIn = visit.check_in_at ? new Date(visit.check_in_at) : null;
    const checkOut = visit.check_out_at ? new Date(visit.check_out_at) : null;

    if (!checkIn || !checkOut) return;

    // Completion SLA: total duration from check-in to check-out
    const actualCompletionHours = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60),
    );

    if (
      client.sla_completion_hours > 0 &&
      actualCompletionHours > client.sla_completion_hours
    ) {
      await this.slaBreachRepo.save(
        this.slaBreachRepo.create({
          visit_id: visit.id,
          client_id: visit.client_id,
          breach_type: 'completion',
          sla_hours: client.sla_completion_hours,
          actual_hours: actualCompletionHours,
        }),
      );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SLA BREACHES
  // ────────────────────────────────────────────────────────────────────────────
  async getSlaBreaches(filters: { clientId?: string; page?: number; limit?: number }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const qb = this.slaBreachRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.client', 'c')
      .leftJoinAndSelect('b.visit', 'v')
      .orderBy('b.breached_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.clientId) {
      qb.where('b.client_id = :clientId', { clientId: filters.clientId });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FORM RESPONSES
  // ────────────────────────────────────────────────────────────────────────────
  async saveFormResponses(visitId: string, responses: FormResponseItemDto[]): Promise<void> {
    for (const r of responses) {
      await this.formResponseRepo.upsert(
        { visit_id: visitId, field_id: r.field_id, value: r.value ?? null },
        { conflictPaths: ['visit_id', 'field_id'] },
      );
    }
  }

  async getFormResponses(visitId: string): Promise<VisitFormResponseEntity[]> {
    return this.formResponseRepo.find({
      where: { visit_id: visitId },
      relations: ['field'],
      order: { created_at: 'ASC' },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ADMIN: FEEDBACK FOTO
  // ────────────────────────────────────────────────────────────────────────────

  async givePhotoFeedback(
    visitId: string,
    photoId: string,
    adminId: string,
    dto: GivePhotoFeedbackDto,
  ): Promise<VisitPhotoEntity> {
    const photo = await this.photoRepo.findOne({ where: { id: photoId, visit_id: visitId } });
    if (!photo) throw new NotFoundException('Foto tidak ditemukan');

    photo.admin_feedback = dto.feedback;
    photo.needs_retake = dto.needs_retake ?? true;
    photo.feedback_by = adminId;
    photo.feedback_at = new Date();
    const saved = await this.photoRepo.save(photo);

    const visit = await this.visitRepo.findOne({ where: { id: visitId } });
    if (visit) {
      await this.notifications.send({
        userId: visit.user_id,
        type: 'photo_feedback',
        title: 'Foto Perlu Diperbaiki',
        body: `Foto fase ${photo.phase}: "${dto.feedback}"`,
        channels: ['push'],
      });
    }
    return saved;
  }

  async clearPhotoFeedback(visitId: string, photoId: string): Promise<VisitPhotoEntity> {
    const photo = await this.photoRepo.findOne({ where: { id: photoId, visit_id: visitId } });
    if (!photo) throw new NotFoundException('Foto tidak ditemukan');

    photo.admin_feedback = null;
    photo.needs_retake = false;
    photo.feedback_by = null;
    photo.feedback_at = null;
    return this.photoRepo.save(photo);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ADMIN: EDIT DATA KUNJUNGAN + AUDIT TRAIL
  // ────────────────────────────────────────────────────────────────────────────

  async adminUpdateVisit(id: string, adminId: string, dto: AdminUpdateVisitDto): Promise<VisitEntity> {
    const visit = await this.visitRepo.findOne({ where: { id } });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan');

    const fields = Object.keys(dto) as (keyof AdminUpdateVisitDto)[];
    const oldData = Object.fromEntries(fields.map((k) => [k, visit[k as keyof VisitEntity]]));
    Object.assign(visit, dto);
    const saved = await this.visitRepo.save(visit);

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        user_id: adminId,
        action: 'update',
        entity_type: 'visit',
        entity_id: id,
        old_data: oldData,
        new_data: Object.fromEntries(fields.map((k) => [k, saved[k as keyof VisitEntity]])),
      }),
    );
    return saved;
  }

  async getVisitAuditLog(id: string): Promise<AuditLogEntity[]> {
    return this.auditLogRepo.find({
      where: { entity_type: 'visit', entity_id: id },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // REVISION FLOW (Opsi C)
  // ────────────────────────────────────────────────────────────────────────────

  async updateReport(userId: string, visitId: string, dto: UpdateVisitReportDto): Promise<VisitEntity> {
    const visit = await this.visitRepo.findOne({ where: { id: visitId, user_id: userId } });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan.');
    if (visit.review_status !== 'revision_needed') {
      throw new BadRequestException('Laporan hanya dapat diedit saat status revisi.');
    }

    if (dto.work_description !== undefined) visit.work_description = dto.work_description;
    if (dto.findings !== undefined) visit.findings = dto.findings ?? null;
    if (dto.recommendations !== undefined) visit.recommendations = dto.recommendations ?? null;
    if (dto.materials_used !== undefined) visit.materials_used = (dto.materials_used as unknown) as Record<string, unknown>[] | null;

    const saved = await this.visitRepo.save(visit);

    if (dto.form_responses?.length) {
      for (const r of dto.form_responses) {
        await this.formResponseRepo.upsert(
          { visit_id: visitId, field_id: r.field_id, value: r.value ?? null },
          { conflictPaths: ['visit_id', 'field_id'] },
        );
      }
    }

    return saved;
  }

  async replacePhoto(
    userId: string,
    visitId: string,
    photoId: string,
    fileBuffer: Buffer,
  ): Promise<VisitPhotoEntity> {
    const visit = await this.visitRepo.findOne({ where: { id: visitId, user_id: userId } });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan.');
    if (visit.review_status !== 'revision_needed') {
      throw new BadRequestException('Foto hanya dapat diganti saat status revisi.');
    }

    const oldPhoto = await this.photoRepo.findOne({ where: { id: photoId, visit_id: visitId } });
    if (!oldPhoto) throw new NotFoundException('Foto tidak ditemukan.');
    if (!oldPhoto.needs_retake) {
      throw new BadRequestException('Hanya foto yang diflag "perlu ganti" yang dapat diganti.');
    }

    const takenAt = new Date();

    const originalBuffer = await sharp(fileBuffer)
      .rotate()
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize({ width: 400 })
      .jpeg({ quality: 75 })
      .toBuffer();
    const fileSizeKb = Math.ceil(originalBuffer.length / 1024);

    const folder = `visits/${visitId}/${oldPhoto.phase}`;
    const [originalUrl, thumbnailUrl] = await Promise.all([
      this.storage.upload(`${folder}/original`, 'jpg', originalBuffer),
      this.storage.upload(`${folder}/thumbnail`, 'jpg', thumbnailBuffer),
    ]);

    // Hapus file lama dari R2 (fire-and-forget — jangan block response)
    void Promise.allSettled([
      this.storage.delete(oldPhoto.original_url),
      oldPhoto.thumbnail_url ? this.storage.delete(oldPhoto.thumbnail_url) : Promise.resolve(),
    ]);

    await this.photoRepo.delete(photoId);

    const newPhoto = this.photoRepo.create({
      visit_id: visitId,
      phase: oldPhoto.phase,
      seq_number: oldPhoto.seq_number,
      original_url: originalUrl,
      watermarked_url: originalUrl,
      thumbnail_url: thumbnailUrl,
      caption: oldPhoto.caption,
      taken_at: takenAt,
      lat: null,
      lng: null,
      district: null,
      province: null,
      file_size_kb: fileSizeKb,
      photo_requirement_id: oldPhoto.photo_requirement_id,
      source: 'gallery',
      admin_feedback: null,
      needs_retake: false,
      feedback_by: null,
      feedback_at: null,
    });

    return this.photoRepo.save(newPhoto);
  }

  async submitRevision(userId: string, visitId: string): Promise<VisitEntity> {
    const visit = await this.visitRepo.findOne({
      where: { id: visitId, user_id: userId },
      relations: ['user'],
    });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan.');
    if (visit.review_status !== 'revision_needed') {
      throw new BadRequestException('Kunjungan tidak dalam status revisi.');
    }

    const pendingRetake = await this.photoRepo.count({ where: { visit_id: visitId, needs_retake: true } });
    if (pendingRetake > 0) {
      throw new BadRequestException(`Masih ada ${pendingRetake} foto yang perlu diganti sebelum dapat mengirim perbaikan.`);
    }

    await this.visitRepo.update(visitId, {
      review_status: null,
      review_rating: null,
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
    });

    const techName = visit.user?.full_name ?? 'Teknisi';
    const adminIds = await this.notifications.getFyiViewerIds([userId]);
    await Promise.all(
      adminIds.map((adminId) =>
        this.notifications.send({
          userId: adminId,
          type: 'visit_revision_submitted',
          title: 'Laporan Kunjungan Diperbaiki',
          body: `${techName} telah memperbaiki laporan. Mohon ditinjau ulang.`,
          data: { visit_id: visitId, type: 'visit_revision_submitted' },
          channels: ['push'],
        }),
      ),
    );

    return this.visitRepo.findOne({ where: { id: visitId }, relations: ['client', 'photos', 'user'] }) as Promise<VisitEntity>;
  }

  private haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
