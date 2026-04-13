import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';

import { AttendanceEntity } from './entities/attendance.entity';

/**
 * Cron: setiap menit
 * Auto check-out karyawan yang belum checkout setelah jam shift selesai
 * checkout_earliest sudah terlewat DAN check_out_at masih NULL
 */
@Injectable()
export class AutoCheckoutJob {
  private readonly logger = new Logger(AutoCheckoutJob.name);

  constructor(
    @InjectRepository(AttendanceEntity)
    private attendanceRepo: Repository<AttendanceEntity>,
  ) {}

  @Cron('* * * * *', { timeZone: 'Asia/Makassar' })
  async run() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    try {
      // Cari karyawan yang sudah check-in, belum checkout,
      // dan shift_end sudah lewat (bandingkan dari shift_end time + date)
      const pending = await this.attendanceRepo
        .createQueryBuilder('a')
        .where('a.date = :today', { today })
        .andWhere('a.check_in_at IS NOT NULL')
        .andWhere('a.check_out_at IS NULL')
        .andWhere('a.shift_end IS NOT NULL')
        .getMany();

      for (const att of pending) {
        if (!att.shift_end) continue;

        const [eh, em] = att.shift_end.split(':').map(Number);
        const shiftEndDate = new Date(`${att.date}T${att.shift_end}:00`);
        // Handle shift lintas tengah malam
        if (eh < 6) shiftEndDate.setDate(shiftEndDate.getDate() + 1);

        if (now >= shiftEndDate) {
          await this.attendanceRepo.update(att.id, {
            check_out_at: shiftEndDate, // checkout di tepat jam selesai
            check_out_method: 'auto' as any,
            overtime_minutes: 0,
          });
          this.logger.log(`Auto checkout: ${att.user_id} @ ${shiftEndDate.toISOString()}`);
        }
      }
    } catch (err) {
      this.logger.error(`Auto-checkout error: ${String(err)}`);
    }
  }
}
