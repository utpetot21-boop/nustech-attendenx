import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeaveService } from '../leave.service';

@Injectable()
export class LeaveExpiryJob {
  constructor(private readonly leave: LeaveService) {}

  // 31 Desember 23:55 WITA
  @Cron('55 23 31 12 *', { timeZone: 'Asia/Makassar' })
  async handle(): Promise<void> {
    await this.leave.runYearEndExpiry();
  }
}
