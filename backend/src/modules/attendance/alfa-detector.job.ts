import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { AttendanceEntity } from './entities/attendance.entity';
import { UserScheduleEntity } from '../schedule/entities/user-schedule.entity';
import { UserEntity } from '../users/entities/user.entity';
import { BusinessTripEntity } from '../business-trips/entities/business-trip.entity';
import { LeaveRequestEntity } from '../leave/entities/leave-request.entity';

/**
 * WITA = UTC+8 (tanpa DST). Konstruksi Date dari "YYYY-MM-DD" + "HH:MM"
 * dengan offset WITA eksplisit, supaya tidak bergantung pada TZ server.
 */
function witaTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h - 8, mi));
}

/** YYYY-MM-DD untuk tanggal hari ini di WITA, bukan UTC. */
function todayWITA(): string {
  const now = new Date();
  const witaMs = now.getTime() + 8 * 60 * 60 * 1000;
  const d = new Date(witaMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Cron tiap jam (WITA) — untuk setiap jadwal hari ini yang shift-nya sudah selesai +30m
 * dan karyawannya belum check-in, tandai absensinya sesuai kondisi:
 * - Ada leave_request approved (cuti/izin/sakit) → record dengan status sesuai tipe
 * - Ada business_trip ongoing/approved → skip (sudah ditangani modul lain)
 * - Selain itu → alfa
 *
 * Pengaman tambahan:
 * - Tidak akan menandai alfa bila shift belum mulai (shift_start di masa depan)
 * - Deteksi shift melewati tengah malam: end_time < start_time (bukan threshold jam)
 */
@Injectable()
export class AlfaDetectorJob {
  private readonly logger = new Logger(AlfaDetectorJob.name);

  constructor(
    @InjectRepository(AttendanceEntity)
    private attendanceRepo: Repository<AttendanceEntity>,
    @InjectRepository(UserScheduleEntity)
    private scheduleRepo: Repository<UserScheduleEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(BusinessTripEntity)
    private tripRepo: Repository<BusinessTripEntity>,
    @InjectRepository(LeaveRequestEntity)
    private leaveRepo: Repository<LeaveRequestEntity>,
  ) {}

  @Cron('0 * * * *', { timeZone: 'Asia/Makassar' })
  async detectAlfa() {
    const now = new Date();
    const today = todayWITA();

    try {
      const schedules = await this.scheduleRepo.find({
        where: { date: today, is_day_off: false, is_holiday: false },
      });

      for (const schedule of schedules) {
        if (!schedule.start_time || !schedule.end_time) continue;

        const shiftStart = witaTime(today, schedule.start_time);

        // Deteksi shift melewati tengah malam: end_time < start_time
        // Contoh: 22:00 → 08:00, end berarti besok
        const endCrossesMidnight =
          schedule.end_time < schedule.start_time;
        let shiftEnd = witaTime(today, schedule.end_time);
        if (endCrossesMidnight) {
          shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
        }
        const shiftEndPlus30 = new Date(shiftEnd.getTime() + 30 * 60 * 1000);

        // Pengaman: shift belum mulai → tidak mungkin alfa
        if (now < shiftStart) continue;
        // Shift sudah selesai tapi masa toleransi 30m belum lewat
        if (now < shiftEndPlus30) continue;

        // Sudah ada record absensi → serahkan ke modul lain, kecuali ada alfa
        // yang perlu dikoreksi menjadi izin/cuti/sakit karena ada leave approved.
        const existing = await this.attendanceRepo.findOne({
          where: { user_id: schedule.user_id, date: today },
        });
        if (existing && existing.status !== 'alfa') continue;
        if (existing && existing.status === 'alfa') {
          const healLeave = await this.leaveRepo.findOne({
            where: {
              user_id: schedule.user_id,
              status: 'approved' as any,
              start_date: LessThanOrEqual(today) as any,
              end_date: MoreThanOrEqual(today) as any,
            },
          });
          if (healLeave && healLeave.type !== 'dinas') {
            await this.attendanceRepo.update(existing.id, {
              status: healLeave.type as any,
              notes: `Auto-heal: leave_request ${healLeave.id}`,
            });
            this.logger.log(
              `Alfa → ${healLeave.type}: user=${schedule.user_id} tanggal=${today}`,
            );
          }
          continue;
        }

        // Business trip ongoing/approved yang mencakup tanggal ini → skip
        const onTrip = await this.tripRepo.findOne({
          where: {
            user_id: schedule.user_id,
            status: 'ongoing' as any,
            depart_date: LessThanOrEqual(today) as any,
            return_date: MoreThanOrEqual(today) as any,
          },
        });
        if (onTrip) continue;

        const approvedTrip = await this.tripRepo.findOne({
          where: {
            user_id: schedule.user_id,
            status: 'approved' as any,
            depart_date: LessThanOrEqual(today) as any,
            return_date: MoreThanOrEqual(today) as any,
          },
        });
        if (approvedTrip) continue;

        // Leave request approved (cuti/izin/sakit/dinas) yang mencakup tanggal ini
        const approvedLeave = await this.leaveRepo.findOne({
          where: {
            user_id: schedule.user_id,
            status: 'approved' as any,
            start_date: LessThanOrEqual(today) as any,
            end_date: MoreThanOrEqual(today) as any,
          },
        });

        // Dinas diurus modul business-trips; leave type 'dinas' diabaikan di sini
        if (approvedLeave && approvedLeave.type !== 'dinas') {
          await this.attendanceRepo.save(
            this.attendanceRepo.create({
              user_id: schedule.user_id,
              user_schedule_id: schedule.id,
              date: today,
              schedule_type: schedule.schedule_type as any,
              shift_start: schedule.start_time,
              shift_end: schedule.end_time,
              tolerance_minutes: schedule.tolerance_minutes,
              status: approvedLeave.type as any,
              late_minutes: 0,
              overtime_minutes: 0,
              notes: `Auto: leave_request ${approvedLeave.id}`,
            }),
          );
          this.logger.log(
            `Leave auto-record: user=${schedule.user_id} tanggal=${today} tipe=${approvedLeave.type}`,
          );
          continue;
        }

        // Tidak ada pembenaran → alfa
        await this.attendanceRepo.save(
          this.attendanceRepo.create({
            user_id: schedule.user_id,
            user_schedule_id: schedule.id,
            date: today,
            schedule_type: schedule.schedule_type as any,
            shift_start: schedule.start_time,
            shift_end: schedule.end_time,
            tolerance_minutes: schedule.tolerance_minutes,
            status: 'alfa' as any,
            late_minutes: 0,
            overtime_minutes: 0,
          }),
        );

        this.logger.log(`Alfa detected: user ${schedule.user_id} tanggal ${today}`);
      }
    } catch (err) {
      this.logger.error(`Alfa detector error: ${String(err)}`);
    }
  }
}
