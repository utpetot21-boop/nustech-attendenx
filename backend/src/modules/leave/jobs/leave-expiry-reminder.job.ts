import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { LeaveBalanceEntity } from '../entities/leave-balance.entity';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * Cron: setiap hari 08:00 WITA
 * Cek H-30 dan H-7 sebelum 31 Desember → kirim notif ke karyawan yang masih punya saldo cuti
 */
@Injectable()
export class LeaveExpiryReminderJob {
  private readonly logger = new Logger(LeaveExpiryReminderJob.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(LeaveBalanceEntity)
    private readonly balanceRepo: Repository<LeaveBalanceEntity>,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 0 8 * * *', { timeZone: 'Asia/Makassar' })
  async handle(): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();

    // Dec 31 of current year
    const endOfYear = new Date(year, 11, 31); // month is 0-indexed
    const diffMs = endOfYear.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays !== 30 && diffDays !== 7) return; // hanya kirim di H-30 dan H-7

    const label = diffDays === 30 ? '30 hari lagi' : '7 hari lagi';

    this.logger.log(`Leave expiry reminder: H-${diffDays} sebelum 31 Des ${year}`);

    try {
      // Cari semua karyawan aktif yang masih punya saldo cuti > 0
      const balances = await this.balanceRepo
        .createQueryBuilder('lb')
        .innerJoin(UserEntity, 'u', 'u.id = lb.user_id')
        .where('lb.year = :year', { year })
        .andWhere('lb.balance_days > 0')
        .andWhere('u.is_active = true')
        .getMany();

      for (const balance of balances) {
        await this.notifications.send({
          userId: balance.user_id,
          type: 'leave_expiry_reminder',
          title: `Saldo cuti akan hangus ${label}!`,
          body: `Anda masih memiliki ${balance.balance_days} hari cuti yang akan hangus pada 31 Desember ${year}. Segera ajukan permohonan cuti sebelum hangus.`,
          channels: ['push'],
        });
      }

      this.logger.log(`Leave expiry reminder sent to ${balances.length} users (H-${diffDays})`);
    } catch (err) {
      this.logger.error(`LeaveExpiryReminder error: ${String(err)}`);
    }
  }
}
