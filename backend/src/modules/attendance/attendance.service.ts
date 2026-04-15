import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';

import { AttendanceEntity } from './entities/attendance.entity';
import { UserScheduleEntity } from '../schedule/entities/user-schedule.entity';
import { LocationEntity } from '../locations/entities/location.entity';
import { NationalHolidayEntity } from '../schedule/entities/national-holiday.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CompanyAttendanceConfigEntity } from '../settings/entities/company-attendance-config.entity';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { isWithinGeofence } from '@nustech/shared';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(AttendanceEntity)
    private attendanceRepo: Repository<AttendanceEntity>,
    @InjectRepository(UserScheduleEntity)
    private scheduleRepo: Repository<UserScheduleEntity>,
    @InjectRepository(LocationEntity)
    private locationRepo: Repository<LocationEntity>,
    @InjectRepository(NationalHolidayEntity)
    private holidayRepo: Repository<NationalHolidayEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(CompanyAttendanceConfigEntity)
    private configRepo: Repository<CompanyAttendanceConfigEntity>,
  ) {}

  // ── Check-In ──────────────────────────────────────────────────
  async checkIn(userId: string, dto: CheckInDto): Promise<AttendanceEntity> {
    const today = this.getTodayString();

    // Cegah double check-in
    const existing = await this.attendanceRepo.findOne({
      where: { user_id: userId, date: today },
    });
    if (existing?.check_in_at) {
      throw new BadRequestException('Anda sudah check-in hari ini');
    }

    // Ambil jadwal hari ini
    const schedule = await this.scheduleRepo.findOne({
      where: { user_id: userId, date: today },
      relations: ['shift_type'],
    });

    if (!schedule) {
      throw new BadRequestException('Tidak ada jadwal untuk hari ini');
    }

    if (schedule.is_day_off) {
      throw new BadRequestException('Hari ini adalah hari libur Anda');
    }

    // Validasi GPS geofence — cek apakah user berada dalam radius lokasi kerjanya
    let gpsValid: boolean | null = null;
    if (dto.lat != null && dto.lng != null) {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['location'],
      });
      const loc = (user as any)?.location;

      // Tentukan titik referensi & radius: lokasi user > konfigurasi global
      let refLat: number | null = null;
      let refLng: number | null = null;
      let radiusMeter = 100;

      if (loc?.lat != null && loc?.lng != null && loc?.radius_meter > 0) {
        refLat = Number(loc.lat);
        refLng = Number(loc.lng);
        radiusMeter = loc.radius_meter;
      } else {
        // Fallback: koordinat kantor global dari konfigurasi absensi
        const cfgs = await this.configRepo.find({ order: { effective_date: 'DESC' }, take: 1 });
        const cfg = cfgs[0];
        if (cfg?.office_lat != null && cfg?.office_lng != null) {
          refLat = Number(cfg.office_lat);
          refLng = Number(cfg.office_lng);
          radiusMeter = cfg.check_in_radius_meter ?? 100;
        }
      }

      if (refLat !== null && refLng !== null) {
        gpsValid = isWithinGeofence(dto.lat, dto.lng, refLat, refLng, radiusMeter);
        if (!gpsValid) {
          throw new BadRequestException(
            `Anda berada di luar area kantor (radius ${radiusMeter} meter). Pastikan GPS aktif dan Anda berada di lokasi yang benar.`,
          );
        }
      }
    }

    // Hitung status berdasarkan keterlambatan
    const checkInAt = new Date();
    const { status, lateMinutes } = this.calculateStatus(
      checkInAt,
      schedule.start_time,
      schedule.tolerance_minutes,
    );

    // Checkout earliest = check_in_at + 8 jam
    const checkoutEarliest = new Date(checkInAt.getTime() + 8 * 60 * 60 * 1000);

    // Cek apakah hari libur nasional → holiday work
    const holiday = await this.holidayRepo.findOne({
      where: { date: today, is_active: true },
    });
    const isHolidayWork = !!holiday;

    if (existing) {
      // Update row yang sudah ada (row mungkin dibuat oleh alfa-detector)
      await this.attendanceRepo.update(existing.id, {
        check_in_at: checkInAt,
        check_in_method: dto.method as any,
        check_in_lat: dto.lat,
        check_in_lng: dto.lng,
        gps_valid: gpsValid,
        checkout_earliest: checkoutEarliest,
        status: status as any,
        late_minutes: lateMinutes,
        is_holiday_work: isHolidayWork,
        user_schedule_id: schedule.id,
        schedule_type: schedule.schedule_type as any,
        shift_start: schedule.start_time,
        shift_end: schedule.end_time,
        tolerance_minutes: schedule.tolerance_minutes,
      });
      return this.attendanceRepo.findOne({ where: { id: existing.id } }) as Promise<AttendanceEntity>;
    }

    return this.attendanceRepo.save(
      this.attendanceRepo.create({
        user_id: userId,
        user_schedule_id: schedule.id,
        date: today,
        schedule_type: schedule.schedule_type as any,
        shift_start: schedule.start_time,
        shift_end: schedule.end_time,
        tolerance_minutes: schedule.tolerance_minutes,
        check_in_at: checkInAt,
        check_in_method: dto.method as any,
        check_in_lat: dto.lat,
        check_in_lng: dto.lng,
        gps_valid: gpsValid,
        checkout_earliest: checkoutEarliest,
        status: status as any,
        late_minutes: lateMinutes,
        is_holiday_work: isHolidayWork,
      }),
    );
  }

  // ── Check-Out ─────────────────────────────────────────────────
  async checkOut(userId: string, dto: CheckOutDto): Promise<AttendanceEntity> {
    const today = this.getTodayString();

    const attendance = await this.attendanceRepo.findOne({
      where: { user_id: userId, date: today },
    });

    if (!attendance?.check_in_at) {
      throw new BadRequestException('Anda belum check-in hari ini');
    }

    if (attendance.check_out_at) {
      throw new BadRequestException('Anda sudah check-out hari ini');
    }

    // Validasi 8 jam lock
    if (!attendance.checkout_earliest) {
      throw new ForbiddenException('Data checkout_earliest tidak tersedia');
    }

    const now = new Date();
    if (now < attendance.checkout_earliest) {
      const remainingMs = attendance.checkout_earliest.getTime() - now.getTime();
      const remainingSec = Math.ceil(remainingMs / 1000);
      throw new ForbiddenException({
        message: 'Checkout belum tersedia — belum 8 jam sejak check-in',
        canCheckout: false,
        remainingSeconds: remainingSec,
        checkoutEarliest: attendance.checkout_earliest,
      });
    }

    const checkOutAt = now;

    // Hitung overtime: actual_checkout - shift_end_time
    const overtimeMinutes = this.calculateOvertime(
      checkOutAt,
      attendance.shift_end,
      attendance.date,
    );

    await this.attendanceRepo.update(attendance.id, {
      check_out_at: checkOutAt,
      check_out_method: dto.method as any,
      overtime_minutes: overtimeMinutes,
    });

    return this.attendanceRepo.findOne({ where: { id: attendance.id } }) as Promise<AttendanceEntity>;
  }

  // ── Ambil data hari ini ───────────────────────────────────────
  async getToday(userId: string): Promise<AttendanceEntity | null> {
    return this.attendanceRepo.findOne({
      where: { user_id: userId, date: this.getTodayString() },
    });
  }

  // ── Riwayat absensi ───────────────────────────────────────────
  async getHistory(
    userId: string,
    filters: { month?: string; from?: string; to?: string },
  ): Promise<AttendanceEntity[]> {
    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId })
      .orderBy('a.date', 'DESC');

    if (filters.month) {
      const [y, m] = filters.month.split('-').map(Number);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
      qb.andWhere('a.date BETWEEN :start AND :end', { start, end });
    } else if (filters.from && filters.to) {
      qb.andWhere('a.date BETWEEN :from AND :to', { from: filters.from, to: filters.to });
    }

    return qb.getMany();
  }

  async getAttendanceList(filters: { date?: string; month?: string; status?: string; departmentId?: string }) {
    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'u')
      .leftJoinAndMapOne('u.department', 'u.department', 'dept')
      .orderBy('a.date', 'DESC')
      .addOrderBy('u.full_name', 'ASC'); // column renamed via migration 022

    if (filters.date) {
      qb.andWhere('a.date = :date', { date: filters.date });
    } else if (filters.month) {
      const [y, m] = filters.month.split('-').map(Number);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
      qb.andWhere('a.date BETWEEN :start AND :end', { start, end });
    }

    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });

    return qb.getMany();
  }

  // ── Ringkasan hari ini (untuk web dashboard) ──────────────────
  async getSummaryToday(): Promise<{
    hadir: number;
    terlambat: number;
    alfa: number;
    total_aktif: number;
    date: string;
  }> {
    const today = this.getTodayString();
    const [rows, totalAktif] = await Promise.all([
      this.attendanceRepo.find({ where: { date: today } }),
      this.userRepo.count({ where: { is_active: true } }),
    ]);

    return {
      hadir: rows.filter((r) => r.status === 'hadir').length,
      terlambat: rows.filter((r) => r.status === 'terlambat').length,
      alfa: rows.filter((r) => r.status === 'alfa').length,
      total_aktif: totalAktif,
      date: today,
    };
  }

  // ── Checkout info (countdown) ─────────────────────────────────
  async getCheckoutInfo(userId: string): Promise<{
    canCheckout: boolean;
    remainingSeconds: number;
    checkoutEarliest: Date | null;
    checkedOut: boolean;
  }> {
    const today = this.getTodayString();
    const att = await this.attendanceRepo.findOne({ where: { user_id: userId, date: today } });

    if (!att?.check_in_at) {
      return { canCheckout: false, remainingSeconds: 0, checkoutEarliest: null, checkedOut: false };
    }

    if (att.check_out_at) {
      return { canCheckout: false, remainingSeconds: 0, checkoutEarliest: att.checkout_earliest, checkedOut: true };
    }

    const now = new Date();
    if (!att.checkout_earliest) {
      return { canCheckout: false, remainingSeconds: 0, checkoutEarliest: null, checkedOut: false };
    }

    const canCheckout = now >= att.checkout_earliest;
    const remainingSeconds = canCheckout
      ? 0
      : Math.ceil((att.checkout_earliest.getTime() - now.getTime()) / 1000);

    return { canCheckout, remainingSeconds, checkoutEarliest: att.checkout_earliest, checkedOut: false };
  }

  // ── Helpers ───────────────────────────────────────────────────
  private getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private calculateStatus(
    checkInAt: Date,
    shiftStart: string | null,
    toleranceMinutes: number,
  ): { status: string; lateMinutes: number } {
    if (!shiftStart) return { status: 'hadir', lateMinutes: 0 };

    const [sh, sm] = shiftStart.split(':').map(Number);
    const shiftStartMs = new Date(checkInAt);
    shiftStartMs.setHours(sh, sm, 0, 0);

    const diffMinutes = Math.floor(
      (checkInAt.getTime() - shiftStartMs.getTime()) / 60000,
    );

    if (diffMinutes <= 0) return { status: 'hadir', lateMinutes: 0 };
    if (diffMinutes <= toleranceMinutes) return { status: 'hadir', lateMinutes: diffMinutes };

    // > toleransi = terlambat
    // > 4 jam = alfa (biasanya ditangani oleh alfa-detector, tapi set di sini juga)
    if (diffMinutes > 240) return { status: 'alfa', lateMinutes: diffMinutes };
    return { status: 'terlambat', lateMinutes: diffMinutes };
  }

  private calculateOvertime(
    checkOutAt: Date,
    shiftEnd: string | null,
    date: string,
  ): number {
    if (!shiftEnd) return 0;

    const [eh, em] = shiftEnd.split(':').map(Number);
    const shiftEndDate = new Date(`${date}T${shiftEnd}`);

    // Handle shift lintas tengah malam
    if (eh < 6) shiftEndDate.setDate(shiftEndDate.getDate() + 1);

    const diff = Math.floor((checkOutAt.getTime() - shiftEndDate.getTime()) / 60000);
    return Math.max(0, diff);
  }
}
