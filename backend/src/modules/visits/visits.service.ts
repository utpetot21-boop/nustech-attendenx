import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VisitEntity } from './entities/visit.entity';
import { VisitPhotoEntity } from './entities/visit-photo.entity';
import { SlaBreachEntity } from './entities/sla-breach.entity';
import { CheckInVisitDto } from './dto/check-in-visit.dto';
import { AddPhotoDto } from './dto/add-photo.dto';
import { CheckOutVisitDto } from './dto/check-out-visit.dto';
import { FormResponseItemDto } from './dto/save-form-responses.dto';
import { NominatimService } from '../../services/nominatim.service';
import { StorageService } from '../../services/storage.service';
import { PhotoWatermarkService } from './photo-watermark.service';
import { ClientEntity } from '../clients/entities/client.entity';
import { VisitFormResponseEntity } from '../templates/entities/visit-form-response.entity';
import { TaskEntity } from '../tasks/entities/task.entity';

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
    private readonly nominatim: NominatimService,
    private readonly storage: StorageService,
    private readonly watermark: PhotoWatermarkService,
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
    const visit = await this.getOngoingVisit(userId, visitId);

    // Count existing photos for this phase
    const phaseCount = await this.photoRepo.count({
      where: { visit_id: visitId, phase: dto.phase },
    });

    const limits = PHOTO_LIMITS[dto.phase];
    if (phaseCount >= limits.max) {
      throw new BadRequestException(
        `Fase "${dto.phase}" sudah mencapai batas maksimum ${limits.max} foto.`,
      );
    }

    // Reverse geocode photo location
    const geo = await this.nominatim.reverse(dto.lat, dto.lng);

    // Watermark + upload
    const takenAt = new Date();
    const { originalBuffer, watermarkedBuffer, thumbnailBuffer, fileSizeKb } =
      await this.watermark.process({
        imageBuffer: fileBuffer,
        takenAt,
        lat: dto.lat,
        lng: dto.lng,
        district: geo.district,
        province: geo.province,
        locationName: (await this.clientRepo.findOneOrFail({ where: { id: visit.client_id } })).name,
      });

    const folder = `visits/${visitId}/${dto.phase}`;
    const [originalUrl, watermarkedUrl, thumbnailUrl] = await Promise.all([
      this.storage.upload(`${folder}/original`, 'jpg', originalBuffer),
      this.storage.upload(`${folder}/watermarked`, 'jpg', watermarkedBuffer),
      this.storage.upload(`${folder}/thumbnail`, 'jpg', thumbnailBuffer),
    ]);

    const photo = this.photoRepo.create({
      visit_id: visitId,
      phase: dto.phase,
      seq_number: phaseCount + 1,
      original_url: originalUrl,
      watermarked_url: watermarkedUrl,
      thumbnail_url: thumbnailUrl,
      caption: dto.caption ?? null,
      taken_at: takenAt,
      lat: dto.lat,
      lng: dto.lng,
      district: geo.district,
      province: geo.province,
      file_size_kb: fileSizeKb,
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

    // Validate minimum photo counts per phase
    const [beforeCount, duringCount, afterCount] = await Promise.all([
      this.photoRepo.count({ where: { visit_id: visitId, phase: 'before' } }),
      this.photoRepo.count({ where: { visit_id: visitId, phase: 'during' } }),
      this.photoRepo.count({ where: { visit_id: visitId, phase: 'after' } }),
    ]);

    if (beforeCount < PHOTO_LIMITS.before.min) {
      throw new BadRequestException(
        `Foto fase "before" belum cukup. Minimal ${PHOTO_LIMITS.before.min} foto, saat ini ${beforeCount}.`,
      );
    }
    if (duringCount < PHOTO_LIMITS.during.min) {
      throw new BadRequestException(
        `Foto fase "during" belum cukup. Minimal ${PHOTO_LIMITS.during.min} foto, saat ini ${duringCount}.`,
      );
    }
    if (afterCount < PHOTO_LIMITS.after.min) {
      throw new BadRequestException(
        `Foto fase "after" belum cukup. Minimal ${PHOTO_LIMITS.after.min} foto, saat ini ${afterCount}.`,
      );
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
    });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan.');
    return visit;
  }

  async getPhotoCounts(
    visitId: string,
  ): Promise<Record<string, { count: number; min: number; max: number }>> {
    const [b, d, a] = await Promise.all([
      this.photoRepo.count({ where: { visit_id: visitId, phase: 'before' } }),
      this.photoRepo.count({ where: { visit_id: visitId, phase: 'during' } }),
      this.photoRepo.count({ where: { visit_id: visitId, phase: 'after' } }),
    ]);
    return {
      before: { count: b, ...PHOTO_LIMITS.before },
      during: { count: d, ...PHOTO_LIMITS.during },
      after: { count: a, ...PHOTO_LIMITS.after },
    };
  }

  async findAll(filters: { status?: string; userId?: string; clientId?: string; date?: string; page?: number; limit?: number }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const qb = this.visitRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'u')
      .leftJoinAndSelect('v.client', 'c')
      .leftJoinAndSelect('v.photos', 'p')
      .leftJoinAndSelect('v.service_report', 'sr')
      .orderBy('v.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) qb.andWhere('v.status = :status', { status: filters.status });
    if (filters.userId) qb.andWhere('v.user_id = :userId', { userId: filters.userId });
    if (filters.clientId) qb.andWhere('v.client_id = :clientId', { clientId: filters.clientId });
    if (filters.date) qb.andWhere('DATE(v.check_in_at) = :date', { date: filters.date });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async getAdminDetail(visitId: string): Promise<VisitEntity> {
    const visit = await this.visitRepo.findOne({
      where: { id: visitId },
      relations: ['client', 'photos', 'user', 'service_report'],
    });
    if (!visit) throw new NotFoundException('Kunjungan tidak ditemukan.');
    return visit;
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
