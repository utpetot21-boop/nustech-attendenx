import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeaveService } from '../leave.service';

@Injectable()
export class PendingDeductionJob {
  constructor(private readonly leave: LeaveService) {}

  // Setiap jam
  @Cron('0 * * * *', { timeZone: 'Asia/Makassar' })
  async handle(): Promise<void> {
    await this.leave.runPendingDeductionExecutor();
  }
}
