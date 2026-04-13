import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { AttendanceEntity } from './entities/attendance.entity';
import { UserScheduleEntity } from '../schedule/entities/user-schedule.entity';
import { UserEntity } from '../users/entities/user.entity';
import { BusinessTripEntity } from '../business-trips/entities/business-trip.entity';

/**
 * Cron: setiap hari 09:00 WITA (deteksi alfa bagi yang belum check-in)
 * Juga dijalankan setelah shift_end + 30 menit (lebih tepat).
 * Untuk simplicity, cron ini jalan tiap jam dan cek semua jadwal hari ini
 * yang shift_end-nya sudah lewat 30 menit.
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
  ) {}

  /**
   * Jalan setiap jam — cek jadwal hari ini yang shift_end + 30m sudah lewat
   * dan karyawannya belum check-in sama sekali
   */
  @Cron('0 * * * *', { timeZone: 'Asia/Makassar' })
  async detectAlfa() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    try {
      const schedules = await this.scheduleRepo.find({
        where: { date: today, is_day_off: false, is_holiday: false },
      });

      for (const schedule of schedules) {
        if (!schedule.end_time) continue;

        // Hitung shift_end + 30 menit
        const [eh, em] = schedule.end_time.split(':').map(Number);
        const shiftEndPlus30 = new Date(`${today}T${schedule.end_time}:00`);
        if (eh < 6) shiftEndPlus30.setDate(shiftEndPlus30.getDate() + 1);
        shiftEndPlus30.setMinutes(shiftEndPlus30.getMinutes() + 30);

        if (now < shiftEndPlus30) continue; // Belum waktunya

        // Cek apakah sudah ada record absensi
        const existing = await this.attendanceRepo.findOne({
          where: { user_id: schedule.user_id, date: today },
        });

        if (existing) continue; // Sudah ada (hadir/terlambat/sudah ditangani)

        // Cek apakah karyawan sedang dinas — jika ya, skip (tidak alfa)
        const onTrip = await this.tripRepo.findOne({
          where: {
            user_id: schedule.user_id,
            status: 'ongoing' as any,
            depart_date: LessThanOrEqual(today) as any,
            return_date: MoreThanOrEqual(today) as any,
          },
        });
        if (onTrip) continue;

        // Juga cek status approved (sudah disetujui tapi belum depart)
        const approvedTrip = await this.tripRepo.findOne({
          where: {
            user_id: schedule.user_id,
            status: 'approved' as any,
            depart_date: LessThanOrEqual(today) as any,
            return_date: MoreThanOrEqual(today) as any,
          },
        });
        if (approvedTrip) continue;

        // Buat record alfa
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
        // TODO: kirim notif ke karyawan (Fase 8 — NotificationsModule)
      }
    } catch (err) {
      this.logger.error(`Alfa detector error: ${String(err)}`);
    }
  }
}
