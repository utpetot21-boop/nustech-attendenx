import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DispatchService } from '../dispatch.service';

@Injectable()
export class EscalationJob {
  constructor(private readonly dispatch: DispatchService) {}

  @Cron('*/5 * * * *', { timeZone: 'Asia/Makassar' })
  async handle(): Promise<void> {
    await this.dispatch.runEscalationCheck();
  }
}
