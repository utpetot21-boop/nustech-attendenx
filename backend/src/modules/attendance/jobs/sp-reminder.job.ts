import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';

import { AttendanceViolationEntity } from '../entities/attendance-violation.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * SP Reminder Job — setiap hari 08:00 WITA
 * Cek jumlah violations per karyawan dalam 30 hari terakhir.
 * Kirim notif HR jika mencapai threshold SP1/SP2/SP3:
 *   - 3 violations → pertimbangkan SP1
 *   - 5 violations → pertimbangkan SP2
 *   - 7 violations → pertimbangkan SP3
 */
@Injectable()
export class SpReminderJob {
  private readonly logger = new Logger(SpReminderJob.name);

  // Threshold per level
  private readonly SP_THRESHOLDS = [
    { count: 7, level: 'SP3', message: 'SP3 (Peringatan Terakhir)' },
    { count: 5, level: 'SP2', message: 'SP2 (Peringatan Kedua)' },
    { count: 3, level: 'SP1', message: 'SP1 (Peringatan Pertama)' },
  ];

  constructor(
    @InjectRepository(AttendanceViolationEntity)
    private violationRepo: Repository<AttendanceViolationEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    private notifications: NotificationsService,
  ) {}

  @Cron('0 0 8 * * *', { timeZone: 'Asia/Makassar' }) // 08:00 WITA setiap hari
  async run(): Promise<void> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      // Ambil semua violations 30 hari terakhir
      const violations = await this.violationRepo.find({
        where: {
          is_resolved: false,
          created_at: MoreThan(since),
        },
        relations: ['user'],
      });

      if (violations.length === 0) return;

      // Group by user
      const perUser = new Map<string, { user: UserEntity; count: number }>();
      for (const v of violations) {
        if (!v.user) continue;
        const existing = perUser.get(v.user_id);
        if (existing) {
          existing.count++;
        } else {
          perUser.set(v.user_id, { user: v.user, count: 1 });
        }
      }

      // Ambil semua admin/HR untuk di-notif
      const hrUsers = await this.userRepo.find({
        where: [
          { role: { name: 'admin' } as any },
          { role: { name: 'hr' } as any },
          { role: { name: 'manager' } as any },
        ],
        relations: ['role'],
        select: { id: true, full_name: true },
      });

      const hrUserIds = hrUsers.map(u => u.id);
      if (hrUserIds.length === 0) {
        this.logger.warn('Tidak ada user HR/admin untuk menerima notif SP reminder');
        return;
      }

      let notifsSent = 0;

      for (const [, { user, count }] of perUser) {
        // Cari threshold yang cocok (tertinggi dulu)
        const matched = this.SP_THRESHOLDS.find(t => count >= t.count);
        if (!matched) continue;

        const message =
          `Karyawan ${user.full_name} memiliki ${count} pelanggaran dalam 30 hari terakhir. ` +
          `Pertimbangkan pemberian ${matched.message}.`;

        this.logger.warn(`SP Reminder: ${message}`);

        // Kirim ke semua HR/admin
        for (const hrId of hrUserIds) {
          await this.notifications.send({
            userId: hrId,
            title: `📋 Reminder ${matched.level} — ${user.full_name}`,
            body: message,
            type: 'sp_reminder',
            data: {
              employee_id: user.id,
              violation_count: String(count),
              suggested_level: matched.level,
            },
          }).catch(() => {});
          notifsSent++;
        }
      }

      if (notifsSent > 0) {
        this.logger.log(`SP Reminder: ${notifsSent} notifikasi dikirim ke HR/admin`);
      }
    } catch (err) {
      this.logger.error(`SpReminderJob error: ${(err as Error).message}`);
    }
  }
}
