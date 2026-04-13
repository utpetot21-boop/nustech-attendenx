import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly serverKey: string | undefined;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    this.serverKey = config.get<string>('FCM_SERVER_KEY');
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'fcm_token'] as never,
    }) as UserEntity & { fcm_token?: string };

    if (!user?.fcm_token) return;
    await this.sendRaw([user.fcm_token], title, body, data);
  }

  async sendToMany(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!userIds.length) return;
    const users = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.fcm_token'] as never[])
      .where('u.id IN (:...ids)', { ids: userIds })
      .getMany() as (UserEntity & { fcm_token?: string })[];

    const tokens = users.map((u) => u.fcm_token).filter(Boolean) as string[];
    if (tokens.length) await this.sendRaw(tokens, title, body, data);
  }

  private async sendRaw(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.serverKey) {
      this.logger.warn('FCM_SERVER_KEY not set, skipping push notification');
      return;
    }

    try {
      const payload = {
        registration_ids: tokens,
        notification: { title, body, sound: 'default' },
        data: data ?? {},
        priority: 'high',
      };

      const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${this.serverKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        this.logger.error(`FCM error: HTTP ${resp.status}`);
      }
    } catch (err) {
      this.logger.error(`FCM send failed: ${err}`);
    }
  }
}
