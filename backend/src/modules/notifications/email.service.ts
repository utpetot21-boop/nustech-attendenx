import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string | undefined;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('EMAIL_FROM') ?? 'noreply@nustech.id';
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not set, skipping email');
      return;
    }

    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ from: this.from, to, subject, html }),
        signal: AbortSignal.timeout(10000),
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
