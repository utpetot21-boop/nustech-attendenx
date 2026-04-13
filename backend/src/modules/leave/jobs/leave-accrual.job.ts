import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeaveService } from '../leave.service';

@Injectable()
export class LeaveAccrualJob {
  constructor(private readonly leave: LeaveService) {}

  // Tgl 1 setiap bulan jam 00:01 WITA
  @Cron('1 0 1 * *', { timeZone: 'Asia/Makassar' })
  async handle(): Promise<void> {
    await this.leave.runMonthlyAccrual();
  }
}
