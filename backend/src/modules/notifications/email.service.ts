import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailAttachment {
  filename: string;
  content: string; // base64
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string | undefined;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('EMAIL_FROM') ?? 'noreply@nustech.id';
  }

  async sendEmail(to: string, subject: string, html: string, attachments?: EmailAttachment[]): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not set, skipping email');
      return;
    }

    try {
      const body: Record<string, unknown> = { from: this.from, to, subject, html };
      if (attachments?.length) body.attachments = attachments;

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        const err = await resp.text();
        this.logger.error(`Resend error: ${resp.status} — ${err}`);
      }
    } catch (err) {
      this.logger.error(`Email send failed: ${err}`);
    }
  }
}
