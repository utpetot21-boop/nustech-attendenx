import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ScheduleSwapRequestEntity } from './entities/schedule-swap-request.entity';
import { UserScheduleEntity } from '../schedule/entities/user-schedule.entity';
import { UserEntity } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSwapRequestDto } from './dto/create-swap-request.dto';
import { RespondSwapDto } from './dto/respond-swap.dto';

@Injectable()
export class ScheduleSwapService {
  constructor(
    @InjectRepository(ScheduleSwapRequestEntity)
    private readonly swapRepo: Repository<ScheduleSwapRequestEntity>,
    @InjectRepository(UserScheduleEntity)
    private readonly scheduleRepo: Repository<UserScheduleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly notif: NotificationsService,
  ) {}

  // ── Create ─────────────────────────────────────────────────────────────────

  async createRequest(requesterId: string, dto: CreateSwapRequestDto): Promise<ScheduleSwapRequestEntity> {
    // Validasi jadwal requester pada requester_date
    const requesterSchedule = await this.scheduleRepo.findOne({
      where: { user_id: requesterId, date: dto.requester_date },
      relations: ['shift_type'],
    });
    if (!requesterSchedule || requesterSchedule.is_day_off) {
      throw new BadRequestException('Anda tidak memiliki jadwal kerja pada tanggal tersebut');
    }

    if (dto.type === 'with_person') {
      if (!dto.target_user_id) {
        throw new BadRequestException('target_user_id wajib diisi untuk tukar dengan teman');
      }
      if (dto.target_user_id === requesterId) {
        throw new BadRequestException('Tidak dapat menukar jadwal dengan diri sendiri');
      }

      // Validasi jadwal target pada target_date
      const targetSchedule = await this.scheduleRepo.findOne({
        where: { user_id: dto.target_user_id, date: dto.target_date },
        relations: ['shift_type'],
      });

      const swap = this.swapRepo.create({
        requester_id: requesterId,
        target_user_id: dto.target_user_id,
        type: dto.type,
        requester_date: dto.requester_date,
        target_date: dto.target_date,
        requester_shift_id: requesterSchedule.shift_type_id ?? null,
        target_shift_id: targetSchedule?.shift_type_id ?? null,
        notes: dto.notes ?? null,
        status: 'pending_target',
      });

      const saved = await this.swapRepo.save(swap);

      // Notifikasi ke target user
      const requester = await this.userRepo.findOne({ where: { id: requesterId } });
      await this.notif.send({
        userId: dto.target_user_id,
        type: 'swap_request_received',
        title: 'Permintaan Tukar Jadwal',
        body: `${requester?.full_name ?? 'Rekan'} mengajukan tukar jadwal dengan Anda`,
        data: { swap_id: saved.id, type: 'swap_request_received' },
      });

      return this.findOne(saved.id);
    }

    // with_own_dayoff: requester tukar hari kerja dengan hari liburnya sendiri
    const ownDayOff = await this.scheduleRepo.findOne({
      where: { user_id: requesterId, date: dto.target_date },
    });
    if (!ownDayOff || !ownDayOff.is_day_off) {
      throw new BadRequestException('Tanggal target bukan hari libur Anda');
    }

    const swap = this.swapRepo.create({
      requester_id: requesterId,
      target_user_id: null,
      type: 'with_own_dayoff',
      requester_date: dto.requester_date,
      target_date: dto.target_date,
      requester_shift_id: requesterSchedule.shift_type_id ?? null,
      target_shift_id: null,
      notes: dto.notes ?? null,
      status: 'pending_admin', // langsung ke admin, tidak perlu persetujuan teman
    });

    const saved = await this.swapRepo.save(swap);

    // Notifikasi ke semua admin
    await this.notifyAdmins('swap_request_admin', 'Permintaan Tukar Jadwal', 'Ada permintaan tukar hari libur yang perlu disetujui', saved.id);

    return this.findOne(saved.id);
  }

  // ── Target user respond ────────────────────────────────────────────────────

  async respondRequest(swapId: string, targetUserId: string, dto: RespondSwapDto): Promise<ScheduleSwapRequestEntity> {
    const swap = await this.findOneOrFail(swapId);

    if (swap.target_user_id !== targetUserId) {
      throw new ForbiddenException('Anda bukan target dari permintaan ini');
    }
    if (swap.status !== 'pending_target') {
      throw new BadRequestException(`Status saat ini: ${swap.status}`);
    }

    if (!dto.approved) {
      await this.swapRepo.update(swapId, {
        status: 'rejected',
        reject_reason: dto.reason ?? 'Ditolak oleh karyawan target',
        target_responded_at: new Date(),
      });

      // Notifikasi ke requester
      await this.notif.send({
        userId: swap.requester_id,
        type: 'swap_request_rejected',
        title: 'Tukar Jadwal Ditolak',
        body: `Permintaan tukar jadwal Anda ditolak oleh ${swap.target_user?.full_name ?? 'rekan'}`,
        data: { swap_id: swapId, type: 'swap_request_rejected' },
      });

      return this.findOne(swapId);
    }

    // Disetujui target → forward ke admin
    await this.swapRepo.update(swapId, {
      status: 'pending_admin',
      target_responded_at: new Date(),
    });

    // Notifikasi ke requester
    await this.notif.send({
      userId: swap.requester_id,
      type: 'swap_request_accepted_by_target',
      title: 'Tukar Jadwal Disetujui Rekan',
      body: `${swap.target_user?.full_name ?? 'Rekan'} menyetujui permintaan tukar jadwal. Menunggu persetujuan admin.`,
      data: { swap_id: swapId, type: 'swap_request_accepted_by_target' },
    });

    // Notifikasi ke admin
    await this.notifyAdmins('swap_request_admin', 'Tukar Jadwal Perlu Persetujuan', 'Permintaan tukar jadwal telah disetujui kedua karyawan', swapId);

    return this.findOne(swapId);
  }

  // ── Admin approve ──────────────────────────────────────────────────────────

  async approveRequest(swapId: string, adminId: string): Promise<ScheduleSwapRequestEntity> {
    const swap = await this.findOneOrFail(swapId);

    if (swap.status !== 'pending_admin') {
      throw new BadRequestException(`Status saat ini: ${swap.status}`);
    }

    // Eksekusi tukar jadwal
    await this.executeSwap(swap);

    await this.swapRepo.update(swapId, {
      status: 'approved',
      approved_by: adminId,
      admin_responded_at: new Date(),
    });

    // Notifikasi ke requester
    await this.notif.send({
      userId: swap.requester_id,
      type: 'swap_request_approved',
      title: 'Tukar Jadwal Disetujui',
      body: 'Permintaan tukar jadwal Anda telah disetujui admin. Jadwal sudah diperbarui.',
      data: { swap_id: swapId, type: 'swap_request_approved' },
    });

    // Notifikasi ke target (jika ada)
    if (swap.target_user_id) {
      await this.notif.send({
        userId: swap.target_user_id,
        type: 'swap_request_approved',
        title: 'Tukar Jadwal Disetujui',
        body: 'Tukar jadwal telah disetujui admin. Jadwal Anda sudah diperbarui.',
        data: { swap_id: swapId, type: 'swap_request_approved' },
      });
    }

    return this.findOne(swapId);
  }

  // ── Admin reject ───────────────────────────────────────────────────────────

  async rejectRequest(swapId: string, adminId: string, reason: string): Promise<ScheduleSwapRequestEntity> {
    const swap = await this.findOneOrFail(swapId);

    if (swap.status !== 'pending_admin') {
      throw new BadRequestException(`Status saat ini: ${swap.status}`);
    }

    await this.swapRepo.update(swapId, {
      status: 'rejected',
      approved_by: adminId,
      reject_reason: reason,
      admin_responded_at: new Date(),
    });

    // Notifikasi ke requester
    await this.notif.send({
      userId: swap.requester_id,
      type: 'swap_request_rejected',
      title: 'Tukar Jadwal Ditolak',
      body: `Permintaan tukar jadwal ditolak admin. Alasan: ${reason}`,
      data: { swap_id: swapId, type: 'swap_request_rejected' },
    });

    if (swap.target_user_id) {
      await this.notif.send({
        userId: swap.target_user_id,
        type: 'swap_request_rejected',
        title: 'Tukar Jadwal Ditolak',
        body: `Permintaan tukar jadwal ditolak admin. Alasan: ${reason}`,
        data: { swap_id: swapId, type: 'swap_request_rejected' },
      });
    }

    return this.findOne(swapId);
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────

  async cancelRequest(swapId: string, userId: string): Promise<void> {
    const swap = await this.findOneOrFail(swapId);

    if (swap.requester_id !== userId) {
      throw new ForbiddenException('Hanya pembuat request yang bisa membatalkan');
    }
    if (!['pending_target', 'pending_admin'].includes(swap.status)) {
      throw new BadRequestException('Request tidak dapat dibatalkan pada status ini');
    }

    await this.swapRepo.update(swapId, { status: 'cancelled' });
  }

  // ── List ───────────────────────────────────────────────────────────────────

  async getRequests(params: {
    userId?: string;
    status?: string;
    isAdmin?: boolean;
    page?: number;
  }) {
    const { userId, status, isAdmin, page = 1 } = params;
    const take = 20;

    const qb = this.swapRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.requester', 'req')
      .leftJoinAndSelect('s.target_user', 'tgt')
      .leftJoinAndSelect('s.requester_shift', 'rs')
      .leftJoinAndSelect('s.target_shift', 'ts')
      .leftJoinAndSelect('s.approver', 'apr')
      .orderBy('s.created_at', 'DESC')
      .skip((page - 1) * take)
      .take(take);

    if (!isAdmin && userId) {
      qb.where('(s.requester_id = :uid OR s.target_user_id = :uid)', { uid: userId });
    }
    if (status) {
      qb.andWhere('s.status = :status', { status });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pages: Math.ceil(total / take) };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async executeSwap(swap: ScheduleSwapRequestEntity): Promise<void> {
    const requesterSchedule = await this.scheduleRepo.findOne({
      where: { user_id: swap.requester_id, date: swap.requester_date },
    });
    const targetSchedule = swap.target_user_id
      ? await this.scheduleRepo.findOne({
          where: { user_id: swap.target_user_id, date: swap.target_date },
        })
      : await this.scheduleRepo.findOne({
          where: { user_id: swap.requester_id, date: swap.target_date },
        });

    if (!requesterSchedule || !targetSchedule) {
      throw new BadRequestException('Jadwal tidak ditemukan, tidak dapat melakukan tukar');
    }

    if (swap.type === 'with_person' && swap.target_user_id) {
      // Tukar shift_type_id antar dua karyawan
      const tmpShiftId   = requesterSchedule.shift_type_id;
      const tmpDayOff    = requesterSchedule.is_day_off;
      const tmpStartTime = requesterSchedule.start_time;
      const tmpEndTime   = requesterSchedule.end_time;

      await this.scheduleRepo.update(requesterSchedule.id, {
        shift_type_id:      targetSchedule.shift_type_id,
        is_day_off:         targetSchedule.is_day_off,
        start_time:         targetSchedule.start_time,
        end_time:           targetSchedule.end_time,
        tolerance_minutes:  targetSchedule.tolerance_minutes,
      });

      await this.scheduleRepo.update(targetSchedule.id, {
        shift_type_id:      tmpShiftId,
        is_day_off:         tmpDayOff,
        start_time:         tmpStartTime,
        end_time:           tmpEndTime,
        tolerance_minutes:  requesterSchedule.tolerance_minutes,
      });
    } else {
      // with_own_dayoff: requester_date jadi libur, target_date jadi kerja
      await this.scheduleRepo.update(requesterSchedule.id, {
        is_day_off: true,
        shift_type_id: null,
      });
      await this.scheduleRepo.update(targetSchedule.id, {
        is_day_off: false,
        shift_type_id: swap.requester_shift_id,
        start_time:    requesterSchedule.start_time,
        end_time:      requesterSchedule.end_time,
        tolerance_minutes: requesterSchedule.tolerance_minutes,
      });
    }
  }

  private async notifyAdmins(type: string, title: string, body: string, swapId: string): Promise<void> {
    // Pakai flag role.can_approve (konsisten dengan Leave / Attendance-Request /
    // Expense-Claim) supaya role kustom yg berhak approve juga dapat notif.
    const admins = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.role', 'r')
      .where('r.can_approve = true')
      .andWhere('u.is_active = true')
      .select(['u.id'])
      .getMany();

    if (admins.length === 0) return;

    await this.notif.sendMany(
      admins.map((a) => a.id),
      type,
      title,
      body,
      { swap_id: swapId, type },
    );
  }

  private async findOne(id: string): Promise<ScheduleSwapRequestEntity> {
    return this.swapRepo.findOne({
      where: { id },
      relations: ['requester', 'target_user', 'requester_shift', 'target_shift', 'approver'],
    }) as Promise<ScheduleSwapRequestEntity>;
  }

  private async findOneOrFail(id: string): Promise<ScheduleSwapRequestEntity> {
    const swap = await this.swapRepo.findOne({
      where: { id },
      relations: ['requester', 'target_user', 'requester_shift', 'target_shift'],
    });
    if (!swap) throw new NotFoundException('Swap request tidak ditemukan');
    return swap;
  }
}
