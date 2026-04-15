import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnnouncementEntity } from './entities/announcement.entity';
import { AnnouncementReadEntity } from './entities/announcement-read.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UserEntity } from '../users/entities/user.entity';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(AnnouncementEntity)
    private annRepo: Repository<AnnouncementEntity>,
    @InjectRepository(AnnouncementReadEntity)
    private readRepo: Repository<AnnouncementReadEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    private notifService: NotificationsService,
  ) {}

  async findAll(status?: string): Promise<AnnouncementEntity[]> {
    const where: any = {};
    if (status) where.status = status;
    return this.annRepo.find({
      where,
      order: { is_pinned: 'DESC', created_at: 'DESC' },
      relations: ['creator'],
    });
  }

  async findOne(id: string): Promise<AnnouncementEntity> {
    const ann = await this.annRepo.findOne({ where: { id }, relations: ['creator'] });
    if (!ann) throw new NotFoundException('Pengumuman tidak ditemukan');
    return ann;
  }

  async create(dto: CreateAnnouncementDto, userId: string): Promise<AnnouncementEntity> {
    const ann = this.annRepo.create({
      ...dto,
      type: dto.type ?? 'info',
      target_type: dto.target_type ?? 'all',
      send_push: dto.send_push ?? true,
      send_whatsapp: dto.send_whatsapp ?? false,
      is_pinned: dto.is_pinned ?? false,
      status: 'draft',
      created_by: userId,
    });
    return this.annRepo.save(ann);
  }

  async send(id: string): Promise<AnnouncementEntity> {
    const ann = await this.findOne(id);
    ann.status = 'sent';
    ann.sent_at = new Date();
    const saved = await this.annRepo.save(ann);

    // Resolve target user IDs
    let targetUserIds: string[] = [];
    if (ann.target_type === 'all') {
      const users = await this.userRepo.find({
        where: { is_active: true },
        select: ['id'],
      });
      targetUserIds = users.map((u) => u.id);
    } else if (ann.target_type === 'department' && ann.target_dept_id) {
      const users = await this.userRepo.find({
        where: { is_active: true, department_id: ann.target_dept_id },
        select: ['id'],
      });
      targetUserIds = users.map((u) => u.id);
    } else if (ann.target_type === 'individual' && ann.target_user_ids?.length) {
      targetUserIds = ann.target_user_ids;
    }

    // Kirim in-app notification + FCM push ke semua target
    if (targetUserIds.length > 0 && ann.send_push) {
      await this.notifService.sendMany(
        targetUserIds,
        'announcement',
        ann.title,
        ann.body.length > 100 ? ann.body.slice(0, 97) + '…' : ann.body,
      );
    }

    return saved;
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);
    await this.annRepo.delete(id);
  }

  async getReadStats(id: string): Promise<{ read: number; total: number; read_pct: number }> {
    const readCount = await this.readRepo.count({ where: { announcement_id: id } });
    return { read: readCount, total: 0, read_pct: 0 };
  }

  async markRead(announcementId: string, userId: string): Promise<void> {
    const exists = await this.readRepo.findOne({ where: { announcement_id: announcementId, user_id: userId } });
    if (!exists) {
      await this.readRepo.save(this.readRepo.create({ announcement_id: announcementId, user_id: userId }));
    }
  }

  async getMyAnnouncements(userId: string): Promise<(AnnouncementEntity & { is_read: boolean })[]> {
    const anns = await this.annRepo.find({
      where: { status: 'sent' },
      order: { is_pinned: 'DESC', sent_at: 'DESC' },
    });
    const reads = await this.readRepo.find({ where: { user_id: userId } });
    const readSet = new Set(reads.map((r) => r.announcement_id));
    return anns.map((a) => ({ ...a, is_read: readSet.has(a.id) }));
  }
}
