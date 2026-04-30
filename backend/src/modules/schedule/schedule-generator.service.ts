import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserEntity } from '../users/entities/user.entity';
import { NationalHolidayEntity } from './entities/national-holiday.entity';
import { OfficeHoursConfigEntity } from './entities/office-hours-config.entity';
import { UserScheduleEntity } from './entities/user-schedule.entity';
import { ShiftTypeEntity } from './entities/shift-type.entity';

@Injectable()
export class ScheduleGeneratorService {
  private readonly logger = new Logger(ScheduleGeneratorService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(UserScheduleEntity)
    private scheduleRepo: Repository<UserScheduleEntity>,
    @InjectRepository(NationalHolidayEntity)
    private holidayRepo: Repository<NationalHolidayEntity>,
    @InjectRepository(OfficeHoursConfigEntity)
    private officeHoursRepo: Repository<OfficeHoursConfigEntity>,
    @InjectRepository(ShiftTypeEntity)
    private shiftRepo: Repository<ShiftTypeEntity>,
  ) {}

  /**
   * Cron: setiap hari jam 23:00 WITA
   * Generate user_schedules untuk esok hari
   */
  @Cron('0 23 * * *', { timeZone: 'Asia/Makassar' })
  async generateTomorrowSchedules() {
    const tomorrow = this.getTomorrow();
    this.logger.log(`🗓️ Generating schedules untuk ${tomorrow}...`);

    try {
      const count = await this.generateForDate(tomorrow);
      this.logger.log(`✅ ${count} jadwal berhasil di-generate untuk ${tomorrow}`);
    } catch (err) {
      this.logger.error(`❌ Gagal generate jadwal: ${String(err)}`);
    }
  }

  /**
   * Generate jadwal untuk tanggal tertentu (bisa dipanggil manual oleh admin)
   */
  async generateForDate(dateStr: string): Promise<number> {
    // Cek apakah hari libur nasional
    const holiday = await this.holidayRepo.findOne({
      where: { date: dateStr, is_active: true },
    });

    // Ambil semua karyawan aktif
    const users = await this.userRepo.find({
      where: { is_active: true },
      select: ['id', 'schedule_type'],
    });

    const dayOfWeek = this.getDayOfWeek(dateStr);
    let generatedCount = 0;

    for (const user of users) {
      // Skip jika jadwal sudah ada untuk hari ini
      const existing = await this.scheduleRepo.findOne({
        where: { user_id: user.id, date: dateStr },
      });
      if (existing) continue;

      if (user.schedule_type === 'office_hours') {
        const saved = await this.generateOfficeHoursSchedule(user.id, dateStr, dayOfWeek, holiday);
        if (saved) generatedCount++;
      }
      // shift: hanya generate jika sudah di-assign admin (lihat assignShift)
    }

    return generatedCount;
  }

  /**
   * Generate jadwal office_hours untuk satu karyawan.
   * Return true jika berhasil disimpan, false jika config tidak ada.
   */
  private async generateOfficeHoursSchedule(
    userId: string,
    dateStr: string,
    dayOfWeek: string,
    holiday: NationalHolidayEntity | null,
  ): Promise<boolean> {
    // Ambil config: prioritas user-specific → global (user_id IS NULL)
    const config =
      (await this.officeHoursRepo
        .createQueryBuilder('oh')
        .where('oh.user_id = :userId', { userId })
        .andWhere('oh.effective_date <= :date', { date: dateStr })
        .orderBy('oh.effective_date', 'DESC')
        .getOne()) ??
      (await this.officeHoursRepo
        .createQueryBuilder('oh')
        .where('oh.user_id IS NULL')
        .andWhere('oh.department_id IS NULL')
        .andWhere('oh.effective_date <= :date', { date: dateStr })
        .orderBy('oh.effective_date', 'DESC')
        .getOne());

    if (!config) return false; // Belum ada konfigurasi office hours

    const isDayOff = !config.work_days.includes(dayOfWeek);
    const isHoliday = !!holiday;

    await this.scheduleRepo.save(
      this.scheduleRepo.create({
        user_id: userId,
        schedule_type: 'office_hours',
        date: dateStr,
        start_time: config.start_time,
        end_time: config.end_time,
        tolerance_minutes: config.tolerance_minutes,
        is_holiday: isHoliday,
        is_day_off: isDayOff,
      }),
    );
    return true;
  }

  /**
   * Admin assign shift ke karyawan untuk tanggal tertentu
   */
  async assignShift(payload: {
    user_id: string;
    shift_type_id: string;
    date: string;
  }): Promise<UserScheduleEntity> {
    const shift = await this.shiftRepo.findOne({
      where: { id: payload.shift_type_id, is_active: true },
    });
    if (!shift) throw new Error(`Shift type ${payload.shift_type_id} tidak ditemukan`);

    const holiday = await this.holidayRepo.findOne({
      where: { date: payload.date, is_active: true },
    });

    // Upsert: jika sudah ada, update
    const existing = await this.scheduleRepo.findOne({
      where: { user_id: payload.user_id, date: payload.date },
    });

    // Shift tidak dipengaruhi libur nasional — karyawan shift tetap bekerja
    if (existing) {
      await this.scheduleRepo.update(existing.id, {
        shift_type_id: payload.shift_type_id,
        schedule_type: 'shift',
        start_time: shift.start_time,
        end_time: shift.end_time,
        tolerance_minutes: shift.tolerance_minutes,
        is_holiday: false,
        is_day_off: false,
      });
      return this.scheduleRepo.findOne({ where: { id: existing.id } }) as Promise<UserScheduleEntity>;
    }

    return this.scheduleRepo.save(
      this.scheduleRepo.create({
        user_id: payload.user_id,
        shift_type_id: payload.shift_type_id,
        schedule_type: 'shift',
        date: payload.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        tolerance_minutes: shift.tolerance_minutes,
        is_holiday: false,
        is_day_off: false,
      }),
    );
  }

  /**
   * Generate jadwal shift pola 5-on-1-off untuk semua karyawan shift.
   * Hari libur didistribusikan otomatis berdasarkan urutan karyawan.
   */
  async generateShiftPattern(payload: {
    shift_type_id: string;
    start_date: string;
    end_date: string;
    cycle_start_date: string;
    /** userId → offset (0–5). Jika tidak ada, fallback ke index % 6 */
    user_offsets?: Record<string, number>;
  }): Promise<{ generated: number }> {
    const shift = await this.shiftRepo.findOne({
      where: { id: payload.shift_type_id, is_active: true },
    });
    if (!shift) throw new Error('Shift type tidak ditemukan');

    // Ambil semua karyawan shift aktif, diurutkan konsisten
    const users = await this.userRepo.find({
      where: { is_active: true, schedule_type: 'shift' as any },
      order: { employee_id: 'ASC' },
      select: ['id', 'employee_id', 'schedule_type'],
    });

    // Bangun daftar tanggal dalam range
    const dates = this.dateRange(payload.start_date, payload.end_date);

    let generated = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      // Gunakan offset manual jika ada, fallback ke index % 6
      const userOffset = payload.user_offsets?.[user.id] ?? (i % 6);

      for (const dateStr of dates) {
        const dayOffset = this.daysBetween(payload.cycle_start_date, dateStr);
        const posInCycle = ((dayOffset + userOffset) % 6 + 6) % 6;
        const isDayOff = posInCycle === 5;

        const existing = await this.scheduleRepo.findOne({
          where: { user_id: user.id, date: dateStr },
        });

        if (isDayOff) {
          if (existing) {
            await this.scheduleRepo.update(existing.id, {
              shift_type_id: null,
              schedule_type: 'shift',
              start_time: shift.start_time,
              end_time: shift.end_time,
              tolerance_minutes: shift.tolerance_minutes,
              is_day_off: true,
              is_holiday: false,
            });
          } else {
            await this.scheduleRepo.save(
              this.scheduleRepo.create({
                user_id: user.id,
                schedule_type: 'shift',
                date: dateStr,
                shift_type_id: null,
                start_time: shift.start_time,
                end_time: shift.end_time,
                tolerance_minutes: shift.tolerance_minutes,
                is_day_off: true,
                is_holiday: false,
              }),
            );
          }
        } else {
          if (existing) {
            await this.scheduleRepo.update(existing.id, {
              shift_type_id: payload.shift_type_id,
              schedule_type: 'shift',
              start_time: shift.start_time,
              end_time: shift.end_time,
              tolerance_minutes: shift.tolerance_minutes,
              is_day_off: false,
              is_holiday: false,
            });
          } else {
            await this.scheduleRepo.save(
              this.scheduleRepo.create({
                user_id: user.id,
                shift_type_id: payload.shift_type_id,
                schedule_type: 'shift',
                date: dateStr,
                start_time: shift.start_time,
                end_time: shift.end_time,
                tolerance_minutes: shift.tolerance_minutes,
                is_day_off: false,
                is_holiday: false,
              }),
            );
          }
        }
        generated++;
      }
    }

    return { generated };
  }

  /** Cek apakah minimal ada satu konfigurasi office hours global */
  async hasOfficeHoursConfig(): Promise<boolean> {
    const count = await this.officeHoursRepo.count({ where: { user_id: null as any, department_id: null as any } });
    return count > 0;
  }

  // ── Helpers ───────────────────────────────────────────────────
  private getTomorrow(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  }

  private getDayOfWeek(dateStr: string): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date(dateStr).getDay()];
  }

  /** Selisih hari antara dua tanggal YYYY-MM-DD (UTC-safe) */
  private daysBetween(from: string, to: string): number {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    return Math.round(
      (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
    );
  }

  /** Daftar tanggal YYYY-MM-DD dari start sampai end (inklusif) */
  private dateRange(start: string, end: string): string[] {
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const dates: string[] = [];
    const cur = new Date(Date.UTC(sy, sm - 1, sd));
    const last = new Date(Date.UTC(ey, em - 1, ed));
    while (cur <= last) {
      dates.push(
        `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(cur.getUTCDate()).padStart(2, '0')}`,
      );
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
  }
}
