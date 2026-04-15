import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { FcmService } from './fcm.service';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';
import { UserEntity } from '../users/entities/user.entity';
import type { RealtimeGateway } from '../realtime/realtime.gateway';

export interface SendNotifOptions {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channels?: ('push' | 'whatsapp' | 'email')[];
  // If channels not provided, auto-select based on type
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notifRepo: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly fcm: FcmService,
    private readonly wa: WhatsAppService,
    private readonly email: EmailService,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  async send(opts: SendNotifOptions): Promise<void> {
    // Persist in-app notification
    const saved = await this.notifRepo.save(
      this.notifRepo.create({
        user_id: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        data: opts.data ?? null,
        channel: 'in_app',
      }),
    );

    // Push via WebSocket (fire-and-forget, optional dep)
    this.realtime?.emitNotification(opts.userId, {
      id: saved.id,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      data: opts.data,
      created_at: saved.created_at,
    });

    const channels = opts.channels ?? this.autoChannels(opts.type);
    const user = await this.userRepo.findOne({
      where: { id: opts.userId },
      select: ['id', 'phone'] as never,
    }) as UserEntity & { phone?: string };

    // Push notification
    if (channels.includes('push')) {
      await this.fcm.sendToUser(opts.userId, opts.title, opts.body, opts.data);
    }

    // WhatsApp
    if (channels.includes('whatsapp') && user?.phone) {
      const waMessage = `*${opts.title}*\n${opts.body}`;
      await this.wa.sendMessage(user.phone, waMessage);
    }

    // Email — only for report-type notifs, skip for now unless email provided
    if (channels.includes('email') && (user as UserEntity & { email?: string })?.email) {
      await this.email.sendEmail(
        (user as UserEntity & { email?: string }).email!,
        opts.title,
        `<p>${opts.body}</p>`,
      );
    }
  }

  async sendMany(
    userIds: string[],
    type: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    // Persist for all
    const entities = userIds.map((uid) =>
      this.notifRepo.create({ user_id: uid, type, title, body, data: data ?? null, channel: 'in_app' }),
    );
    const saved = await this.notifRepo.save(entities);

    // WebSocket emit per user
    saved.forEach((n) => {
      this.realtime?.emitNotification(n.user_id, {
        id: n.id,
        type,
        title,
        body,
        data,
        created_at: n.created_at,
      });
    });

    // Push to all
    await this.fcm.sendToMany(userIds, title, body, data);
  }

  async getForUser(userId: string, page = 1, limit = 30) {
    const [items, total] = await this.notifRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async markRead(userId: string, notifId: string): Promise<void> {
    await this.notifRepo.update({ id: notifId, user_id: userId }, {
      is_read: true,
      read_at: new Date(),
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifRepo
      .createQueryBuilder()
      .update()
      .set({ is_read: true, read_at: new Date() })
      .where('user_id = :uid AND is_read = false', { uid: userId })
      .execute();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifRepo.count({ where: { user_id: userId, is_read: false } });
  }

  private autoChannels(type: string): ('push' | 'whatsapp' | 'email')[] {
    const critical = ['task_assigned', 'alfa_detected', 'task_hold_submitted', 'sos'];
    const push = ['leave_approved', 'leave_rejected', 'delegation_request', 'ba_generated'];
    if (critical.includes(type)) return ['push', 'whatsapp'];
    if (push.includes(type)) return ['push'];
    return ['push'];
  }
}
