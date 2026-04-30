import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NationalHolidayEntity } from '../../schedule/entities/national-holiday.entity';
import { LeaveBalanceEntity } from '../entities/leave-balance.entity';
import { LeaveBalanceLogEntity } from '../entities/leave-balance-log.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { toWitaDate } from '../../../common/utils/date.util';

@Injectable()
export class CollectiveLeaveJob {
  private readonly logger = new Logger(CollectiveLeaveJob.name);

  constructor(
    @InjectRepository(NationalHolidayEntity)
    private readonly holidayRepo: Repository<NationalHolidayEntity>,
    @InjectRepository(LeaveBalanceEntity)
    private readonly balanceRepo: Repository<LeaveBalanceEntity>,
    @InjectRepository(LeaveBalanceLogEntity)
    private readonly logRepo: Repository<LeaveBalanceLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  // Setiap hari 00:01 WITA — cek apakah besok cuti bersama
  @Cron('1 0 * * *', { timeZone: 'Asia/Makassar' })
  async handle(): Promise<void> {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const tomorrowStr = toWitaDate(tomorrow);
    const year = parseInt(tomorrowStr.slice(0, 4), 10);

    const collectiveHoliday = await this.holidayRepo.findOne({
      where: {
        date: tomorrowStr,
        is_collective_leave: true as never,
        is_active: true,
      },
    });

    if (!collectiveHoliday) return;

    this.logger.log(`Collective leave deduction for ${tomorrowStr}: ${collectiveHoliday.name}`);

    const users = await this.userRepo.find({ where: { is_active: true } });

    for (const user of users) {
      const balance = await this.balanceRepo.findOne({
        where: { user_id: user.id, year },
      });
      if (!balance || Number(balance.balance_days) <= 0) continue;

      const newBalance = Math.max(0, Number(balance.balance_days) - 1);
      await this.balanceRepo.update(balance.id, { balance_days: newBalance });
      await this.logRepo.save(
        this.logRepo.create({
          user_id: user.id,
          type: 'collective_leave_deduction',
          amount: -1,
          balance_after: newBalance,
          notes: `Cuti bersama: ${collectiveHoliday.name}`,
        }),
      );
    }
  }
}
