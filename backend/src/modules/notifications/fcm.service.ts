import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as admin from 'firebase-admin';
import { UserEntity } from '../users/entities/user.entity';
import { UserDeviceEntity } from '../users/entities/user-device.entity';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserDeviceEntity)
    private readonly deviceRepo: Repository<UserDeviceEntity>,
  ) {}

  onModuleInit() {
    const projectId   = this.config.get<string>('FCM_PROJECT_ID');
    const clientEmail = this.config.get<string>('FCM_CLIENT_EMAIL');
    const privateKey  = this.config.get<string>('FCM_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('FCM credentials not set — push notifications disabled');
      return;
    }

    try {
      // Hindari inisialisasi ganda saat hot-reload
      this.app = admin.apps.find((a) => a?.name === 'attendenx')
        ?? admin.initializeApp(
          {
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
          },
          'attendenx',
        );
      this.logger.log('Firebase Admin SDK initialized');
    } catch (err) {
      this.logger.error(`Firebase Admin init failed: ${err}`);
    }
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const devices = await this.deviceRepo.find({
      where: { user_id: userId, is_active: true },
      select: ['fcm_token'],
    });
    const tokens = devices.map((d) => d.fcm_token).filter(Boolean);
    if (tokens.length) await this.sendRaw(tokens, title, body, data);
  }

  async sendToMany(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!userIds.length) return;
    const devices = await this.deviceRepo.find({
      where: { user_id: In(userIds), is_active: true },
      select: ['fcm_token'],
    });
    const tokens = [...new Set(devices.map((d) => d.fcm_token).filter(Boolean))];
    if (tokens.length) await this.sendRaw(tokens, title, body, data);
  }

  private async sendRaw(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.app) {
      this.logger.warn('FCM not initialized, skipping push');
      return;
    }

    // FCM sendEachForMulticast — maks 500 token per batch
    const BATCH = 500;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      try {
        const response = await admin.messaging(this.app).sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
          data: data ?? {},
          android: {
            priority: 'high',
            notification: { sound: 'default', channelId: 'default' },
          },
          apns: {
            payload: { aps: { sound: 'default', badge: 1 } },
          },
        });
        const failed = response.responses.filter((r) => !r.success).length;
        if (failed > 0) this.logger.warn(`FCM: ${failed}/${batch.length} messages failed`);
      } catch (err) {
        this.logger.error(`FCM sendEachForMulticast error: ${err}`);
      }
    }
  }
}
