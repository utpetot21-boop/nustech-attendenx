import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  // send() hanya untuk role yang bisa skip approval (manager / super_admin)
  async send(id: string): Promise<AnnouncementEntity> {
    const ann = await this.findOne(id);
    ann.status = 'sent';
    ann.sent_at = new Date();
    const saved = await this.annRepo.save(ann);
    await this._sendPushToTargets(saved);
    return saved;
  }

  // ── Submit untuk approval (role: admin) ──────────────────────────────────────
  async submit(id: string, userId: string): Promise<AnnouncementEntity> {
    const ann = await this.findOne(id);
    if (ann.created_by !== userId) throw new ForbiddenException('Hanya pembuat yang bisa mengajukan');
    if (!['draft', 'rejected'].includes(ann.status)) {
      throw new BadRequestException('Hanya pengumuman berstatus draft atau rejected yang bisa diajukan');
    }
    ann.status = 'pending_approval';
    ann.rejection_reason = null;
    const saved = await this.annRepo.save(ann);

    // Notifikasi ke semua manager & super_admin
    const approvers = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.role', 'r')
      .where("r.name IN ('manager','super_admin')")
      .andWhere('u.is_active = true')
      .select(['u.id'])
      .getMany();

    const creator = await this.userRepo.findOne({ where: { id: userId }, select: ['full_name'] });
    if (approvers.length > 0) {
      await this.notifService.sendMany(
        approvers.map((u) => u.id),
        'announcement_pending',
        'Pengumuman Menunggu Persetujuan',
        `"${ann.title}" dari ${creator?.full_name ?? 'Admin'} perlu disetujui`,
      );
    }
    return saved;
  }

  // ── Approve (role: manager / super_admin) ─────────────────────────────────────
  async approve(id: string, approverId: string): Promise<AnnouncementEntity> {
    const ann = await this.findOne(id);
    if (ann.status !== 'pending_approval') {
      throw new BadRequestException('Hanya pengumuman berstatus pending_approval yang bisa disetujui');
    }
    ann.status = 'sent';
    ann.sent_at = new Date();
    ann.approved_by = approverId;
    ann.approved_at = new Date();
    const saved = await this.annRepo.save(ann);

    // Kirim push notification ke target
    await this._sendPushToTargets(saved);

    // Notifikasi ke pembuat
    await this.notifService.send({
      userId: ann.created_by,
      type: 'announcement_approved',
      title: 'Pengumuman Disetujui',
      body: `"${ann.title}" telah disetujui dan dikirim`,
      channels: ['push'],
    });

    return saved;
  }

  // ── Reject (role: manager / super_admin) ──────────────────────────────────────
  async reject(id: string, approverId: string, reason: string): Promise<AnnouncementEntity> {
    const ann = await this.findOne(id);
    if (ann.status !== 'pending_approval') {
      throw new BadRequestException('Hanya pengumuman berstatus pending_approval yang bisa ditolak');
    }
    ann.status = 'rejected';
    ann.rejection_reason = reason;
    ann.approved_by = approverId;
    ann.approved_at = new Date();
    const saved = await this.annRepo.save(ann);

    // Notifikasi ke pembuat
    await this.notifService.send({
      userId: ann.created_by,
      type: 'announcement_rejected',
      title: 'Pengumuman Ditolak',
      body: `"${ann.title}" ditolak: ${reason}`,
      channels: ['push'],
    });

    return saved;
  }

  // ── Helper: kirim push ke target users ───────────────────────────────────────
  private async _sendPushToTargets(ann: AnnouncementEntity): Promise<void> {
    if (!ann.send_push) return;
    let targetUserIds: string[] = [];
    if (ann.target_type === 'all') {
      const users = await this.userRepo.find({ where: { is_active: true }, select: ['id'] });
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
    if (targetUserIds.length > 0) {
      await this.notifService.sendMany(
        targetUserIds,
        'announcement',
        ann.title,
        ann.body.length > 100 ? ann.body.slice(0, 97) + '…' : ann.body,
      );
    }
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
