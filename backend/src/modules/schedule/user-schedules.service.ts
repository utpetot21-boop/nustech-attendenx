import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { UserScheduleEntity } from './entities/user-schedule.entity';
import { ScheduleChangeLogEntity } from './entities/schedule-change-log.entity';
import { ScheduleGeneratorService } from './schedule-generator.service';

@Injectable()
export class UserSchedulesService {
  constructor(
    @InjectRepository(UserScheduleEntity)
    private repo: Repository<UserScheduleEntity>,
    @InjectRepository(ScheduleChangeLogEntity)
    private changeLogRepo: Repository<ScheduleChangeLogEntity>,
    private generatorService: ScheduleGeneratorService,
  ) {}

  /**
   * Ambil jadwal satu user — bisa filter date, week, atau month
   */
  async findForUser(
    userId: string,
    filters: { date?: string; week?: string; month?: string },
  ): Promise<UserScheduleEntity[]> {
    const { date, week, month } = filters;

    if (date) {
      const row = await this.repo.findOne({ where: { user_id: userId, date } });
      return row ? [row] : [];
    }

    if (week) {
      // week = "2025-W20" → Senin–Minggu
      const { start, end } = this.weekRange(week);
      return this.repo.find({
        where: { user_id: userId, date: Between(start, end) },
        order: { date: 'ASC' },
      });
    }

    if (month) {
      // month = "2025-05"
      const [year, mon] = month.split('-').map(Number);
      const start = `${year}-${String(mon).padStart(2, '0')}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const end = `${year}-${String(mon).padStart(2, '0')}-${lastDay}`;
      return this.repo.find({
        where: { user_id: userId, date: Between(start, end) },
        order: { date: 'ASC' },
      });
    }

    // Jika tidak ada filter → kembalikan 30 hari ke depan
    const today = new Date().toISOString().split('T')[0];
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const futureStr = future.toISOString().split('T')[0];
    return this.repo.find({
      where: { user_id: userId, date: Between(today, futureStr) },
      order: { date: 'ASC' },
    });
  }

  /**
   * Ambil jadwal team — filter by dept & week
   */
  async findTeamSchedule(filters: {
    dept?: string;
    week?: string;
  }): Promise<UserScheduleEntity[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('u.department', 'dept')
      .leftJoinAndSelect('s.shift_type', 'shift');

    if (filters.dept) {
      qb.where('u.department_id = :dept', { dept: filters.dept });
    }

    if (filters.week) {
      const { start, end } = this.weekRange(filters.week);
      qb.andWhere('s.date BETWEEN :start AND :end', { start, end });
    }

    return qb.orderBy('s.date', 'ASC').addOrderBy('u.full_name', 'ASC').getMany();
  }

  /**
   * Generate jadwal untuk tanggal tertentu (trigger manual oleh admin)
   */
  async generateForDate(dateStr: string): Promise<{ generated: number }> {
    const count = await this.generatorService.generateForDate(dateStr);
    return { generated: count };
  }

  /**
   * Generate jadwal shift pola 5-on-1-off untuk semua karyawan shift
   */
  async generateShiftPattern(payload: {
    shift_type_id: string;
    start_date: string;
    end_date: string;
    cycle_start_date: string;
  }): Promise<{ generated: number }> {
    return this.generatorService.generateShiftPattern(payload);
  }

  /**
   * Generate jadwal untuk seluruh bulan (YYYY-MM)
   */
  async generateForMonth(month: string): Promise<{ generated: number; skipped: number }> {
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    let generated = 0;
    let skipped = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      try {
        const count = await this.generatorService.generateForDate(dateStr);
        generated += count;
        if (count === 0) skipped++;
      } catch {
        skipped++;
      }
    }
    return { generated, skipped };
  }

  /**
   * Assign shift ke karyawan (oleh admin)
   */
  async assignShift(payload: {
    user_id: string;
    shift_type_id: string;
    date: string;
    changed_by?: string;
    reason?: string;
  }): Promise<UserScheduleEntity> {
    // Record old shift before overwriting
    const existing = await this.repo.findOne({
      where: { user_id: payload.user_id, date: payload.date },
    });

    const result = await this.generatorService.assignShift(payload);

    // Log the change
    if (payload.changed_by) {
      await this.changeLogRepo.save(
        this.changeLogRepo.create({
          user_id: payload.user_id,
          changed_by: payload.changed_by,
          date: payload.date,
          old_shift_type_id: existing?.shift_type_id ?? null,
          new_shift_type_id: payload.shift_type_id,
          reason: payload.reason ?? null,
        }),
      );
    }

    return result;
  }

  /**
   * Override manual jadwal harian (office_hours maupun shift).
   * Admin bisa paksa is_day_off=true/false untuk tanggal tertentu.
   */
  async overrideDay(payload: {
    user_id: string;
    date: string;
    is_day_off: boolean;
    changed_by?: string;
  }): Promise<UserScheduleEntity> {
    const existing = await this.repo.findOne({
      where: { user_id: payload.user_id, date: payload.date },
    });

    if (existing) {
      await this.repo.update(existing.id, { is_day_off: payload.is_day_off });
      if (payload.changed_by) {
        await this.changeLogRepo.save(
          this.changeLogRepo.create({
            user_id: payload.user_id,
            changed_by: payload.changed_by,
            date: payload.date,
            old_shift_type_id: existing.shift_type_id ?? null,
            new_shift_type_id: existing.shift_type_id ?? null,
            reason: payload.is_day_off ? 'Manual: libur' : 'Manual: masuk kerja',
          }),
        );
      }
      return this.repo.findOne({ where: { id: existing.id } }) as Promise<UserScheduleEntity>;
    }

    // Buat entry baru (belum di-generate sebelumnya)
    const entry = await this.repo.save(
      this.repo.create({
        user_id: payload.user_id,
        date: payload.date,
        schedule_type: 'office_hours',
        start_time: '08:00',
        end_time: '16:00',
        tolerance_minutes: 15,
        is_day_off: payload.is_day_off,
        is_holiday: false,
      }),
    );

    if (payload.changed_by) {
      await this.changeLogRepo.save(
        this.changeLogRepo.create({
          user_id: payload.user_id,
          changed_by: payload.changed_by,
          date: payload.date,
          old_shift_type_id: null,
          new_shift_type_id: null,
          reason: payload.is_day_off ? 'Manual: libur' : 'Manual: masuk kerja',
        }),
      );
    }

    return entry;
  }

  /**
   * Hapus assignment shift karyawan untuk tanggal tertentu
   */
  async unassignShift(userId: string, date: string): Promise<void> {
    const existing = await this.repo.findOne({
      where: { user_id: userId, date, schedule_type: 'shift' as any },
    });
    if (existing) await this.repo.remove(existing);
  }

  /**
   * Ambil riwayat perubahan jadwal seorang karyawan
   */
  async getChangeLogs(userId: string, filters: { month?: string }): Promise<ScheduleChangeLogEntity[]> {
    const qb = this.changeLogRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.old_shift_type', 'oldS')
      .leftJoinAndSelect('l.new_shift_type', 'newS')
      .leftJoinAndSelect('l.changer', 'ch')
      .where('l.user_id = :userId', { userId })
      .orderBy('l.date', 'DESC');

    if (filters.month) {
      const [year, mon] = filters.month.split('-').map(Number);
      const start = `${year}-${String(mon).padStart(2, '0')}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const end = `${year}-${String(mon).padStart(2, '0')}-${lastDay}`;
      qb.andWhere('l.date BETWEEN :start AND :end', { start, end });
    }

    return qb.getMany();
  }

  // ── Helpers ──────────────────────────────────────────────────────
  private weekRange(week: string): { start: string; end: string } {
    // week = "2025-W20"
    const [yearStr, weekPart] = week.split('-W');
    const year = parseInt(yearStr, 10);
    const weekNum = parseInt(weekPart, 10);

    // ISO week: Senin = hari pertama
    const jan4 = new Date(year, 0, 4); // 4 Jan selalu di week 1
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));

    const monday = new Date(startOfWeek1);
    monday.setDate(startOfWeek1.getDate() + (weekNum - 1) * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Gunakan local date formatting, bukan toISOString() yang UTC
    // (toISOString() shift tanggal di server timezone UTC+8 → end jadi Sabtu bukan Minggu)
    const fmtLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return { start: fmtLocal(monday), end: fmtLocal(sunday) };
  }
}
