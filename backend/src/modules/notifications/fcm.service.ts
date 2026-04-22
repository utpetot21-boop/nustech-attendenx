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
    channelId: string = 'default',
  ): Promise<void> {
    const devices = await this.deviceRepo.find({
      where: { user_id: userId, is_active: true },
      select: ['fcm_token'],
    });
    const tokens = devices.map((d) => d.fcm_token).filter(Boolean);
    if (tokens.length) await this.sendRaw(tokens, title, body, data, channelId);
  }

  async sendToMany(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    channelId: string = 'default',
  ): Promise<void> {
    if (!userIds.length) return;
    const devices = await this.deviceRepo.find({
      where: { user_id: In(userIds), is_active: true },
      select: ['fcm_token'],
    });
    const tokens = [...new Set(devices.map((d) => d.fcm_token).filter(Boolean))];
    if (tokens.length) await this.sendRaw(tokens, title, body, data, channelId);
  }

  private async sendRaw(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    channelId: string = 'default',
  ): Promise<void> {
    // Pisahkan Expo tokens dan raw FCM tokens
    const expoTokens = tokens.filter((t) => t.startsWith('ExponentPushToken['));
    const fcmTokens  = tokens.filter((t) => !t.startsWith('ExponentPushToken['));

    await Promise.all([
      expoTokens.length ? this.sendViaExpo(expoTokens, title, body, data, channelId) : Promise.resolve(),
      fcmTokens.length  ? this.sendViaFCM(fcmTokens, title, body, data, channelId)   : Promise.resolve(),
    ]);
  }

  // ── Expo Push API (untuk Expo Go / development) ──────────────────────────────
  private async sendViaExpo(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    channelId: string = 'default',
  ): Promise<void> {
    const BATCH = 100;
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH).map((to) => ({
        to,
        title,
        body,
        data: data ?? {},
        sound: 'default',
        priority: 'high',
        channelId,
      }));
      try {
        const resp = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) this.logger.error(`Expo Push error: HTTP ${resp.status}`);
        else this.logger.debug(`Expo Push: sent ${batch.length} notifications`);
      } catch (err) {
        this.logger.error(`Expo Push send failed: ${err}`);
      }
    }
  }

  // ── Firebase Admin SDK (untuk production build) ──────────────────────────────
  private async sendViaFCM(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    channelId: string = 'default',
  ): Promise<void> {
    if (!this.app) {
      this.logger.warn('FCM not initialized, skipping FCM push');
      return;
    }
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
            notification: { sound: 'default', channelId },
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
