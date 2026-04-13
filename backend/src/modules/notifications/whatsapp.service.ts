import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

// Dynamically imported to avoid issues in environments without Chromium
type WAClient = {
  initialize(): Promise<void>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  sendMessage(chatId: string, message: string): Promise<unknown>;
  sendFile?(chatId: string, content: unknown, filename: string, caption: string): Promise<unknown>;
  getState?(): Promise<string>;
};

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private client: WAClient | null = null;
  private qrCode: string | null = null;
  private isReady = false;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    @InjectQueue('whatsapp') private readonly waQueue: Queue,
  ) {
    this.enabled = config.get<string>('WA_ENABLED') === 'true';
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('WhatsApp disabled (WA_ENABLED != true)');
      return;
    }
    await this.initClient();
  }

  private async initClient(): Promise<void> {
    try {
      const { Client, LocalAuth } = await import('whatsapp-web.js');
      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: './.wa-session' }),
        puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
      }) as unknown as WAClient;

      this.client.on('qr', (qr: unknown) => {
        this.qrCode = qr as string;
        this.logger.log('WhatsApp QR code generated — scan with /admin/wa/qr');
      });

      this.client.on('ready', () => {
        this.isReady = true;
        this.qrCode = null;
        this.logger.log('WhatsApp client ready');
      });

      this.client.on('disconnected', async () => {
        this.isReady = false;
        this.logger.warn('WhatsApp disconnected, retrying in 30s...');
        setTimeout(() => this.initClient(), 30_000);
      });

      await this.client.initialize();
    } catch (err) {
      this.logger.error(`WhatsApp init error: ${err}`);
    }
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    // Normalise phone: e.g. "08xx" → "628xx@c.us"
    const chatId = this.normaliseChatId(phone);
    await this.waQueue.add(
      'send',
      { chatId, message },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
  }

  async dispatchSendJob(chatId: string, message: string): Promise<void> {
    if (!this.isReady || !this.client) {
      this.logger.warn(`WA not ready, dropping message to ${chatId}`);
      return;
    }
    try {
      await this.client.sendMessage(chatId, message);
    } catch (err) {
      this.logger.error(`WA send failed: ${err}`);
    }
  }

  getQrCode(): string | null { return this.qrCode; }
  getStatus(): { connected: boolean; qr: boolean } {
    return { connected: this.isReady, qr: !!this.qrCode };
  }

  private normaliseChatId(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const intl = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
    return `${intl}@c.us`;
  }
}
