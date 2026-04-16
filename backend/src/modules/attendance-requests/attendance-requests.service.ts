import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AttendanceRequestEntity } from './entities/attendance-request.entity';
import { AttendanceEntity } from '../attendance/entities/attendance.entity';
import { UserScheduleEntity } from '../schedule/entities/user-schedule.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAttendanceRequestDto } from './dto/create-attendance-request.dto';
import { ReviewAttendanceRequestDto } from './dto/review-attendance-request.dto';

@Injectable()
export class AttendanceRequestsService {
  constructor(
    @InjectRepository(AttendanceRequestEntity)
    private requestRepo: Repository<AttendanceRequestEntity>,
    @InjectRepository(AttendanceEntity)
    private attendanceRepo: Repository<AttendanceEntity>,
    @InjectRepository(UserScheduleEntity)
    private scheduleRepo: Repository<UserScheduleEntity>,
    private notificationsService: NotificationsService,
  ) {}

  private getTodayString(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
  }

  // ── Submit permohonan ─────────────────────────────────────────
  async submit(userId: string, dto: CreateAttendanceRequestDto): Promise<AttendanceRequestEntity> {
    const today = this.getTodayString();

    // Cegah duplikasi request pada tanggal + tipe yang sama
    const existing = await this.requestRepo.findOne({
      where: { user_id: userId, date: today, type: dto.type },
    });
    if (existing && existing.status !== 'cancelled') {
      throw new BadRequestException(
        `Permohonan ${dto.type === 'late_arrival' ? 'izin terlambat' : 'izin pulang awal'} untuk hari ini sudah ada`,
      );
    }

    // Ambil jadwal hari ini untuk validasi waktu
    const schedule = await this.scheduleRepo.findOne({
      where: { user_id: userId, date: today },
    });

    if (!schedule) {
      throw new BadRequestException('Tidak ada jadwal untuk hari ini');
    }
    if (schedule.is_day_off) {
      throw new BadRequestException('Hari ini adalah hari libur Anda');
    }

    if (dto.type === 'late_arrival') {
      // Validasi: harus diajukan minimal 15 menit sebelum shift mulai
      if (!schedule.start_time) {
        throw new BadRequestException('Jadwal shift tidak memiliki jam mulai');
      }
      const [sh, sm] = schedule.start_time.split(':').map(Number);
      const deadline = new Date();
      deadline.setHours(sh, sm - 15, 0, 0);
      if (new Date() >= deadline) {
        throw new BadRequestException(
          'Batas pengajuan izin terlambat adalah 15 menit sebelum jam shift dimulai',
        );
      }
    }

    if (dto.type === 'early_departure') {
      // Harus sudah check-in hari ini
      const attendance = await this.attendanceRepo.findOne({
        where: { user_id: userId, date: today },
      });
      if (!attendance?.check_in_at) {
        throw new BadRequestException('Anda belum check-in hari ini');
      }
      if (attendance.check_out_at) {
        throw new BadRequestException('Anda sudah check-out hari ini');
      }
      // Harus sebelum jam shift selesai
      if (schedule.end_time) {
        const [eh, em] = schedule.end_time.split(':').map(Number);
        const shiftEnd = new Date();
        shiftEnd.setHours(eh, em, 0, 0);
        if (new Date() >= shiftEnd) {
          throw new BadRequestException('Jam shift sudah berakhir, tidak perlu izin pulang awal');
        }
      }
    }

    const request = this.requestRepo.create({
      user_id: userId,
      date: today,
      type: dto.type,
      reason: dto.reason,
      estimated_time: dto.estimated_time ?? null,
      status: 'pending',
    });

    return this.requestRepo.save(request);
  }

  // ── Approve ───────────────────────────────────────────────────
  async approve(adminId: string, id: string, dto: ReviewAttendanceRequestDto): Promise<AttendanceRequestEntity> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!request) throw new NotFoundException('Permohonan tidak ditemukan');
    if (request.status !== 'pending') {
      throw new BadRequestException('Permohonan ini sudah diproses');
    }

    await this.requestRepo.update(id, {
      status: 'approved',
      reviewed_by: adminId,
      reviewer_note: dto.reviewer_note ?? null,
      reviewed_at: new Date(),
    });

    // Update flag di tabel attendances jika record sudah ada
    const att = await this.attendanceRepo.findOne({
      where: { user_id: request.user_id, date: request.date },
    });
    if (att) {
      if (request.type === 'late_arrival') {
        await this.attendanceRepo.update(att.id, { late_approved: true });
      } else {
        await this.attendanceRepo.update(att.id, { early_departure_approved: true });
      }
    }

    // Notifikasi ke karyawan
    const label = request.type === 'late_arrival' ? 'Izin Terlambat' : 'Izin Pulang Awal';
    await this.notificationsService.send({
      userId: request.user_id,
      type: 'attendance_request_approved',
      title: `${label} Disetujui`,
      body: `Permohonan ${label.toLowerCase()} Anda untuk hari ini telah disetujui.`,
    });

    return this.requestRepo.findOne({ where: { id }, relations: ['user', 'reviewer'] }) as Promise<AttendanceRequestEntity>;
  }

  // ── Reject ────────────────────────────────────────────────────
  async reject(adminId: string, id: string, dto: ReviewAttendanceRequestDto): Promise<AttendanceRequestEntity> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!request) throw new NotFoundException('Permohonan tidak ditemukan');
    if (request.status !== 'pending') {
      throw new BadRequestException('Permohonan ini sudah diproses');
    }

    await this.requestRepo.update(id, {
      status: 'rejected',
      reviewed_by: adminId,
      reviewer_note: dto.reviewer_note ?? null,
      reviewed_at: new Date(),
    });

    const label = request.type === 'late_arrival' ? 'Izin Terlambat' : 'Izin Pulang Awal';
    await this.notificationsService.send({
      userId: request.user_id,
      type: 'attendance_request_rejected',
      title: `${label} Ditolak`,
      body: dto.reviewer_note
        ? `Permohonan ${label.toLowerCase()} Anda ditolak. Alasan: ${dto.reviewer_note}`
        : `Permohonan ${label.toLowerCase()} Anda ditolak.`,
    });

    return this.requestRepo.findOne({ where: { id }, relations: ['user', 'reviewer'] }) as Promise<AttendanceRequestEntity>;
  }

  // ── Karyawan: lihat permohonan sendiri ────────────────────────
  async getMyRequests(userId: string, params: { date?: string; type?: string } = {}): Promise<AttendanceRequestEntity[]> {
    const qb = this.requestRepo
      .createQueryBuilder('r')
      .where('r.user_id = :userId', { userId })
      .orderBy('r.created_at', 'DESC');

    if (params.date) qb.andWhere('r.date = :date', { date: params.date });
    if (params.type) qb.andWhere('r.type = :type', { type: params.type });

    return qb.getMany();
  }

  // ── Karyawan: permohonan hari ini ─────────────────────────────
  async getMyToday(userId: string): Promise<AttendanceRequestEntity[]> {
    return this.requestRepo.find({
      where: { user_id: userId, date: this.getTodayString() },
      order: { created_at: 'DESC' },
    });
  }

  // ── Admin: list permohonan ────────────────────────────────────
  async getAdminList(params: {
    status?: string;
    type?: string;
    date?: string;
    page?: number;
  }): Promise<{ items: AttendanceRequestEntity[]; total: number }> {
    const page = params.page ?? 1;
    const take = 20;

    const qb = this.requestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .leftJoinAndSelect('r.reviewer', 'rv')
      .orderBy('r.created_at', 'DESC')
      .skip((page - 1) * take)
      .take(take);

    if (params.status) qb.andWhere('r.status = :status', { status: params.status });
    if (params.type)   qb.andWhere('r.type = :type',   { type: params.type });
    if (params.date)   qb.andWhere('r.date = :date',   { date: params.date });

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ── Jumlah pending untuk badge notif admin ────────────────────
  async getPendingCount(): Promise<number> {
    return this.requestRepo.count({ where: { status: 'pending' } });
  }
}
