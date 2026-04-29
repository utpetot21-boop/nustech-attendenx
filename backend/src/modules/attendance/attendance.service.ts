import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';

import { AttendanceEntity } from './entities/attendance.entity';
import { UserScheduleEntity } from '../schedule/entities/user-schedule.entity';
import { LocationEntity } from '../locations/entities/location.entity';
import { NationalHolidayEntity } from '../schedule/entities/national-holiday.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CompanyAttendanceConfigEntity } from '../settings/entities/company-attendance-config.entity';
import { AttendanceRequestEntity } from '../attendance-requests/entities/attendance-request.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';
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
    @InjectRepository(AttendanceRequestEntity)
    private attendanceRequestRepo: Repository<AttendanceRequestEntity>,
    private notificationsService: NotificationsService,
  ) {}

  // ── Ambil titik geofence efektif untuk user (personal > global) ───────
  async getMyOffice(userId: string): Promise<{
    lat: number | null;
    lng: number | null;
    radius_meter: number;
    office_name: string;
  }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['location'],
    });
    const loc = (user as any)?.location;

    if (loc?.lat != null && loc?.lng != null && loc?.radius_meter > 0) {
      return {
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        radius_meter: loc.radius_meter,
        office_name: loc.name ?? 'Kantor',
      };
    }

    const cfgs = await this.configRepo.find({ order: { effective_date: 'DESC' }, take: 1 });
    const cfg = cfgs[0];
    if (cfg?.office_lat != null && cfg?.office_lng != null) {
      return {
        lat: Number(cfg.office_lat),
        lng: Number(cfg.office_lng),
        radius_meter: cfg.check_in_radius_meter ?? 100,
        office_name: 'Kantor',
      };
    }

    return { lat: null, lng: null, radius_meter: 100, office_name: 'Kantor' };
  }

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

    // P1: Tolak check-in lebih dari 30 menit sebelum shift dimulai
    const { allowed: earlyAllowed } = this.checkEarlyWindow(new Date(), schedule.start_time, 30);
    if (!earlyAllowed) {
      throw new BadRequestException(
        `Check-in terlalu awal. Anda baru dapat check-in 30 menit sebelum shift dimulai pukul ${schedule.start_time} WITA.`,
      );
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

    // Cek apakah ada izin terlambat yang diapprove hari ini
    const approvedLate = await this.attendanceRequestRepo.findOne({
      where: { user_id: userId, date: today, type: 'late_arrival', status: 'approved' },
    });

    // Hitung status berdasarkan keterlambatan
    const checkInAt = new Date();
    const { status: rawStatus, lateMinutes } = this.calculateStatus(
      checkInAt,
      schedule.start_time,
      schedule.tolerance_minutes,
    );
    // Jika terlambat tapi ada izin approved → tetap terlambat tapi flag late_approved = true
    const status = rawStatus;

    // Wajib isi alasan jika terlambat dan tidak ada izin approved — enforce di backend
    // agar tidak bisa di-bypass meski jam device dimanipulasi (frontend skip modal)
    if (rawStatus === 'terlambat' && !approvedLate && !dto.notes?.trim()) {
      throw new BadRequestException(
        'Anda terlambat. Wajib mengisi alasan keterlambatan.',
      );
    }

    // P2: checkout_earliest = MAX(checkInAt + 8 jam, shiftEndTime WITA)
    // Mencegah early check-in memungkinkan checkout sebelum shift selesai
    const checkoutFrom8h = new Date(checkInAt.getTime() + 8 * 60 * 60 * 1000);
    let checkoutEarliest = checkoutFrom8h;
    if (schedule.end_time) {
      const witaDateCo = checkInAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
      const [coEh] = schedule.end_time.split(':').map(Number);
      let shiftEndWita = new Date(`${witaDateCo}T${schedule.end_time.slice(0, 5)}:00+08:00`);
      if (Number.isFinite(coEh) && coEh < 6) {
        shiftEndWita = new Date(shiftEndWita.getTime() + 24 * 60 * 60 * 1000);
      }
      checkoutEarliest = new Date(Math.max(checkoutFrom8h.getTime(), shiftEndWita.getTime()));
    }

    // Cek apakah hari libur nasional → holiday work
    const holiday = await this.holidayRepo.findOne({
      where: { date: today, is_active: true },
    });
    const isHolidayWork = !!holiday;

    let saved: AttendanceEntity;

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
        late_approved: !!approvedLate,
        is_holiday_work: isHolidayWork,
        user_schedule_id: schedule.id,
        schedule_type: schedule.schedule_type as any,
        shift_start: schedule.start_time,
        shift_end: schedule.end_time,
        tolerance_minutes: schedule.tolerance_minutes,
        notes: dto.notes ?? null,
      });
      saved = (await this.attendanceRepo.findOne({ where: { id: existing.id } })) as AttendanceEntity;
    } else {
      saved = await this.attendanceRepo.save(
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
          late_approved: !!approvedLate,
          is_holiday_work: isHolidayWork,
          notes: dto.notes ?? null,
        }),
      );
    }

    // Kirim push notification konfirmasi check-in
    const checkInTimeStr = checkInAt.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar',
    });
    const notifBody = lateMinutes > 0 && !approvedLate
      ? `Check-in pukul ${checkInTimeStr} WITA — terlambat ${lateMinutes} menit.`
      : `Check-in berhasil pukul ${checkInTimeStr} WITA.`;
    this.notificationsService.send({
      userId,
      type: 'check_in_success',
      title: isHolidayWork ? 'Check-In (Hari Libur)' : 'Check-In Berhasil',
      body: notifBody,
    }).catch(() => { /* non-critical — jangan gagalkan check-in */ });

    return saved;
  }

  // ── Check-Out ─────────────────────────────────────────────────
  async checkOut(userId: string, dto: CheckOutDto): Promise<AttendanceEntity> {
    const attendance = await this.findActiveAttendance(userId);

    if (!attendance?.check_in_at) {
      throw new BadRequestException('Anda belum check-in hari ini');
    }

    if (attendance.check_out_at) {
      throw new BadRequestException('Anda sudah check-out hari ini');
    }

    // Cek izin pulang awal approved — bypass lock 8 jam
    // Gunakan attendance.date bukan today — shift malam bisa record dari kemarin
    const approvedEarly = await this.attendanceRequestRepo.findOne({
      where: { user_id: userId, date: attendance.date, type: 'early_departure', status: 'approved' },
    });

    const now = new Date();

    // Validasi 8 jam lock (dilewati jika ada izin pulang awal approved)
    if (!approvedEarly) {
      if (!attendance.checkout_earliest) {
        throw new ForbiddenException('Data checkout_earliest tidak tersedia');
      }
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
    }

    // Validasi GPS geofence saat check-out — wajib seperti check-in
    let checkOutGpsValid: boolean | null = null;
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['location'],
    });
    const loc = (user as any)?.location;

    let refLat: number | null = null;
    let refLng: number | null = null;
    let radiusMeter = 100;

    if (loc?.lat != null && loc?.lng != null && loc?.radius_meter > 0) {
      refLat = Number(loc.lat);
      refLng = Number(loc.lng);
      radiusMeter = loc.radius_meter;
    } else {
      const cfgs = await this.configRepo.find({ order: { effective_date: 'DESC' }, take: 1 });
      const cfg = cfgs[0];
      if (cfg?.office_lat != null && cfg?.office_lng != null) {
        refLat = Number(cfg.office_lat);
        refLng = Number(cfg.office_lng);
        radiusMeter = cfg.check_in_radius_meter ?? 100;
      }
    }

    if (refLat !== null && refLng !== null) {
      checkOutGpsValid = isWithinGeofence(dto.lat, dto.lng, refLat, refLng, radiusMeter);
      if (!checkOutGpsValid) {
        throw new BadRequestException(
          `Anda berada di luar area kantor (radius ${radiusMeter} meter). Pastikan GPS aktif dan Anda berada di lokasi yang benar.`,
        );
      }
    }

    const checkOutAt = now;

    // Hitung overtime: actual_checkout - shift_end_time, cap 3 jam (180 menit)
    const rawOvertime = this.calculateOvertime(checkOutAt, attendance.shift_end, attendance.date);
    const overtimeMinutes = Math.min(rawOvertime, 180);

    // Notif semua admin + super_admin jika lembur melebihi 3 jam
    if (rawOvertime > 180) {
      const admins = await this.userRepo.find({
        where: { role: In(['admin', 'super_admin']), is_active: true },
      });
      const employeeName = user?.full_name ?? 'Karyawan';
      for (const admin of admins) {
        this.notificationsService.send({
          userId: admin.id,
          type: 'overtime_exceeded',
          title: 'Lembur Melebihi 3 Jam',
          body: `${employeeName} lembur ${rawOvertime} menit (batas 180 menit). Mohon ditinjau.`,
        }).catch(() => {});
      }
    }

    await this.attendanceRepo.update(attendance.id, {
      check_out_at: checkOutAt,
      check_out_method: dto.method as any,
      check_out_lat: dto.lat ?? null,
      check_out_lng: dto.lng ?? null,
      check_out_gps_valid: checkOutGpsValid,
      overtime_minutes: overtimeMinutes,
      early_departure_approved: !!approvedEarly,
    });

    // Kirim push notification konfirmasi check-out
    const checkOutTimeStr = checkOutAt.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar',
    });
    const checkOutBody = overtimeMinutes > 0
      ? `Check-out pukul ${checkOutTimeStr} WITA — lembur ${overtimeMinutes} menit.`
      : `Check-out berhasil pukul ${checkOutTimeStr} WITA. Sampai jumpa besok!`;
    this.notificationsService.send({
      userId,
      type: 'check_out_success',
      title: 'Check-Out Berhasil',
      body: checkOutBody,
    }).catch(() => { /* non-critical */ });

    return this.attendanceRepo.findOne({ where: { id: attendance.id } }) as Promise<AttendanceEntity>;
  }

  // ── Ambil data hari ini ───────────────────────────────────────
  async getToday(userId: string): Promise<AttendanceEntity | null> {
    return this.findActiveAttendance(userId);
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

    if (filters.status && filters.status !== 'terjadwal') {
      qb.andWhere('a.status = :status', { status: filters.status });
    }

    const attendances = await qb.getMany();

    // Mode daily: tambahkan baris virtual "terjadwal" untuk karyawan yang
    // punya jadwal hari itu tapi belum ada record absensi (belum check-in,
    // shift belum lewat + 30 menit). Mode monthly tidak di-augment.
    if (!filters.date) return attendances;

    const schedules = await this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .leftJoinAndMapOne('u.department', 'u.department', 'dept')
      .where('s.date = :date', { date: filters.date })
      .andWhere('s.is_day_off = false')
      .andWhere('s.is_holiday = false')
      .getMany();

    const attUserIds = new Set(attendances.map((a) => a.user_id));
    const virtuals = schedules
      .filter((s) => !attUserIds.has(s.user_id) && !!s.user)
      .map(
        (s) =>
          ({
            id: `sched_${s.id}`,
            user_id: s.user_id,
            date: filters.date!,
            status: 'terjadwal',
            check_in_at: null,
            check_out_at: null,
            check_in_method: null,
            check_out_method: null,
            late_minutes: 0,
            overtime_minutes: 0,
            gps_valid: null,
            tolerance_minutes: s.tolerance_minutes,
            shift_start: s.start_time,
            shift_end: s.end_time,
            schedule_type: s.schedule_type,
            is_holiday_work: false,
            notes: null,
            late_approved: false,
            early_departure_approved: false,
            user: s.user,
            created_at: s.created_at,
          }) as any,
      );

    if (filters.status === 'terjadwal') return virtuals;
    return [...attendances, ...virtuals];
  }

  // ── Ringkasan hari ini (untuk web dashboard) ──────────────────
  async getSummaryToday(): Promise<{
    hadir: number;
    terlambat: number;
    alfa: number;
    terjadwal: number;
    total_aktif: number;
    date: string;
  }> {
    const today = this.getTodayString();
    const [rows, schedules, totalAktif] = await Promise.all([
      this.attendanceRepo.find({ where: { date: today } }),
      this.scheduleRepo.find({
        where: { date: today, is_day_off: false, is_holiday: false },
      }),
      this.userRepo.count({ where: { is_active: true } }),
    ]);

    const attUserIds = new Set(rows.map((r) => r.user_id));
    const terjadwal = schedules.filter((s) => !attUserIds.has(s.user_id)).length;

    // "hadir" = semua yang check-in hari ini (termasuk yang terlambat / pulang awal).
    // "terlambat" adalah subset dari hadir, bukan kategori terpisah.
    return {
      hadir: rows.filter((r) => !!r.check_in_at).length,
      terlambat: rows.filter((r) => r.status === 'terlambat').length,
      alfa: rows.filter((r) => r.status === 'alfa').length,
      terjadwal,
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
    const att = await this.findActiveAttendance(userId);

    if (!att?.check_in_at) {
      return { canCheckout: false, remainingSeconds: 0, checkoutEarliest: null, checkedOut: false };
    }

    if (att.check_out_at) {
      return { canCheckout: false, remainingSeconds: 0, checkoutEarliest: att.checkout_earliest, checkedOut: true };
    }

    // Izin pulang awal approved → bypass lock 8 jam (konsisten dgn checkOut())
    // Gunakan att.date bukan today — shift malam bisa record dari kemarin
    const approvedEarly = await this.attendanceRequestRepo.findOne({
      where: { user_id: userId, date: att.date, type: 'early_departure', status: 'approved' },
    });
    if (approvedEarly) {
      return {
        canCheckout: true,
        remainingSeconds: 0,
        checkoutEarliest: att.checkout_earliest,
        checkedOut: false,
      };
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

  // ── Koreksi oleh Admin ────────────────────────────────────────
  async correctAttendance(
    adminId: string,
    attendanceId: string,
    dto: CorrectAttendanceDto,
  ): Promise<AttendanceEntity> {
    const record = await this.attendanceRepo.findOne({ where: { id: attendanceId } });
    if (!record) throw new NotFoundException('Data absensi tidak ditemukan');

    const updates: Partial<Pick<AttendanceEntity,
      'check_in_at' | 'check_out_at' | 'checkout_earliest' |
      'status' | 'late_minutes' | 'overtime_minutes' | 'notes'
    >> = {};

    if (dto.check_in_at !== undefined) {
      const newCheckIn = new Date(dto.check_in_at);
      updates.check_in_at = newCheckIn;

      // P2: checkout_earliest = MAX(checkIn + 8 jam, shiftEnd WITA)
      const corrFrom8h = new Date(newCheckIn.getTime() + 8 * 60 * 60 * 1000);
      let corrCheckoutEarliest = corrFrom8h;
      if (record.shift_end && record.date) {
        const [corrEh] = record.shift_end.split(':').map(Number);
        let corrShiftEnd = new Date(`${record.date}T${record.shift_end.slice(0, 5)}:00+08:00`);
        if (Number.isFinite(corrEh) && corrEh < 6) {
          corrShiftEnd = new Date(corrShiftEnd.getTime() + 24 * 60 * 60 * 1000);
        }
        corrCheckoutEarliest = new Date(Math.max(corrFrom8h.getTime(), corrShiftEnd.getTime()));
      }
      updates.checkout_earliest = corrCheckoutEarliest;

      if (record.shift_start) {
        const { status: rawStatus, lateMinutes } = this.calculateStatus(
          newCheckIn,
          record.shift_start,
          record.tolerance_minutes,
        );
        if (!dto.status) updates.status = rawStatus as any;
        updates.late_minutes = lateMinutes;
      }
    }

    if (dto.check_out_at !== undefined) {
      const newCheckOut = new Date(dto.check_out_at);
      updates.check_out_at = newCheckOut;
      updates.overtime_minutes = this.calculateOvertime(newCheckOut, record.shift_end, record.date);
    }

    if (dto.status) updates.status = dto.status as any;

    const corrNote = `[Koreksi ${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} oleh admin]: ${dto.correction_reason}`;
    const existingNotes = record.notes ? record.notes.split('\n').filter((l) => !l.startsWith('[Koreksi')).join('\n').trim() : '';
    const adminNotes = dto.notes?.trim() ? `\nCatatan: ${dto.notes.trim()}` : '';
    updates.notes = [existingNotes, corrNote + adminNotes].filter(Boolean).join('\n');

    await this.attendanceRepo.update(attendanceId, updates);
    return this.attendanceRepo.findOne({ where: { id: attendanceId } }) as Promise<AttendanceEntity>;
  }

  // ── Helpers ───────────────────────────────────────────────────
  // Cek apakah check-in masih dalam window yang diizinkan (maks windowMinutes sebelum shift)
  private checkEarlyWindow(
    now: Date,
    shiftStart: string,
    windowMinutes: number,
  ): { allowed: boolean; minutesEarly: number } {
    const witaDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    const shiftStartMs = new Date(`${witaDate}T${shiftStart.slice(0, 5)}:00+08:00`);
    const minutesEarly = Math.floor((shiftStartMs.getTime() - now.getTime()) / 60000);
    return { allowed: minutesEarly <= windowMinutes, minutesEarly: Math.max(0, minutesEarly) };
  }

  private getTodayString(): string {
    // Gunakan WITA (Asia/Makassar, UTC+8) bukan UTC
    // toISOString() selalu UTC — jika dipakai, check-in antara 00:00-07:59 WITA
    // akan terekam di tanggal kemarin
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
  }

  private getYesterdayString(): string {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
  }

  // Cross-midnight: cari attendance aktif (sudah check-in, belum check-out).
  // Shift malam yang check-in sebelum 00:00 dan belum checkout setelah 00:00
  // akan ditemukan di record kemarin, bukan hari ini.
  private async findActiveAttendance(userId: string): Promise<AttendanceEntity | null> {
    const today = this.getTodayString();
    const todayAtt = await this.attendanceRepo.findOne({ where: { user_id: userId, date: today } });
    if (todayAtt?.check_in_at && !todayAtt.check_out_at) return todayAtt;
    if (todayAtt?.check_in_at) return todayAtt; // sudah checkout, kembalikan hari ini

    // Belum ada record hari ini — cek kemarin untuk shift malam yang masih aktif
    const yesterday = this.getYesterdayString();
    const yesterdayAtt = await this.attendanceRepo.findOne({ where: { user_id: userId, date: yesterday } });
    if (yesterdayAtt?.check_in_at && !yesterdayAtt.check_out_at) return yesterdayAtt;

    return todayAtt ?? null;
  }

  private calculateStatus(
    checkInAt: Date,
    shiftStart: string | null,
    toleranceMinutes: number,
  ): { status: string; lateMinutes: number } {
    if (!shiftStart) return { status: 'hadir', lateMinutes: 0 };

    // Bangun shift start dalam WITA — hindari setHours() yang bergantung timezone server
    // slice(0,5) normalisasi "HH:MM:SS" → "HH:MM" sebelum append :00+08:00
    const witaDate = checkInAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    const shiftStartMs = new Date(`${witaDate}T${shiftStart.slice(0, 5)}:00+08:00`);

    const diffMinutes = Math.floor(
      (checkInAt.getTime() - shiftStartMs.getTime()) / 60000,
    );

    if (diffMinutes <= 0) return { status: 'hadir', lateMinutes: 0 };
    if (diffMinutes <= toleranceMinutes) return { status: 'hadir', lateMinutes: diffMinutes };

    // > toleransi = terlambat, berapa pun menit keterlambatannya.
    // Status 'alfa' HANYA diset oleh alfa-detector (tidak hadir sama sekali).
    // Jika user aktif check-in, dia hadir secara fisik — tidak boleh dikategorikan alfa.
    return { status: 'terlambat', lateMinutes: diffMinutes };
  }

  private calculateOvertime(
    checkOutAt: Date,
    shiftEnd: string | null,
    date: string,
  ): number {
    if (!shiftEnd) return 0;

    // Gunakan +08:00 (WITA) agar tidak bergantung timezone server
    // slice(0,5) normalisasi "HH:MM:SS" → "HH:MM" sebelum append :00+08:00
    const [eh] = shiftEnd.split(':').map(Number);
    const shiftEndDate = new Date(`${date}T${shiftEnd.slice(0, 5)}:00+08:00`);

    // Handle shift lintas tengah malam (misal berakhir 02:00 WITA)
    if (Number.isFinite(eh) && eh < 6) {
      shiftEndDate.setTime(shiftEndDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const diff = Math.floor((checkOutAt.getTime() - shiftEndDate.getTime()) / 60000);
    return Math.max(0, diff);
  }
}
