import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { WhatsAppService } from './whatsapp.service';

@Processor('whatsapp')
export class WhatsAppProcessor {
  constructor(private readonly wa: WhatsAppService) {}

  @Process('send')
  async handleSend(job: Job<{ chatId: string; message: string }>): Promise<void> {
    await this.wa.dispatchSendJob(job.data.chatId, job.data.message);
  }
}
