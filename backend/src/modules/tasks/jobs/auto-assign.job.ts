import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DispatchService } from '../dispatch.service';

@Injectable()
export class AutoAssignJob {
  constructor(private readonly dispatch: DispatchService) {}

  @Cron('*/30 * * * * *', { timeZone: 'Asia/Makassar' })
  async handle(): Promise<void> {
    await this.dispatch.runAutoAssign();
  }
}
