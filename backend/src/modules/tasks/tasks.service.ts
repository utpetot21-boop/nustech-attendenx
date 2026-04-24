import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { TaskEntity } from './entities/task.entity';
import { TaskAssignmentEntity } from './entities/task-assignment.entity';
import { DelegationEntity } from './entities/delegation.entity';
import { TaskHoldEntity } from './entities/task-hold.entity';
import { UserEntity } from '../users/entities/user.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { DispatchService } from './dispatch.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { RejectTaskDto } from './dto/accept-reject-task.dto';
import { DelegateTaskDto } from './dto/delegate-task.dto';
import { HandoverTaskDto } from './dto/handover-task.dto';
import { SwapRequestDto } from './dto/swap-request.dto';
import { HoldTaskDto } from './dto/hold-task.dto';
import { ApproveHoldDto, RejectHoldDto } from './dto/review-hold.dto';
import { CancelTaskDto } from './dto/cancel-task.dto';
import { NotificationsService } from '../notifications/notifications.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Rendah',
  normal: 'Normal',
  high: 'Tinggi',
  urgent: 'Mendesak',
};

// Auto-approve deadline in minutes per priority
const HOLD_AUTO_APPROVE_MINUTES: Record<string, number> = {
  normal: 240,  // 4 jam
  high: 120,    // 2 jam
  urgent: 30,   // 30 menit
};

const HOLD_REASON_LABELS: Record<string, string> = {
  client_absent:        'Klien/PIC tidak ada di lokasi',
  access_denied:        'Tidak bisa masuk gedung/area',
  equipment_broken:     'Peralatan rusak di lokasi',
  material_unavailable: 'Spare part/material belum tersedia',
  client_cancel:        'Klien batalkan sepihak',
  weather:              'Cuaca ekstrem',
  technician_sick:      'Teknisi sakit mendadak',
  other:                'Alasan lain',
};

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TaskAssignmentEntity)
    private readonly assignRepo: Repository<TaskAssignmentEntity>,
    @InjectRepository(DelegationEntity)
    private readonly delegationRepo: Repository<DelegationEntity>,
    @InjectRepository(TaskHoldEntity)
    private readonly holdRepo: Repository<TaskHoldEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(VisitEntity)
    private readonly visitRepo: Repository<VisitEntity>,
    private readonly dispatch: DispatchService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  // NOTIFICATION HELPERS
  // ────────────────────────────────────────────────────────────────────────────
  private async notifyAssignee(taskId: string, assigneeId: string): Promise<void> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['client', 'creator'],
    });
    if (!task) return;
    const priorityLabel = PRIORITY_LABEL[task.priority] ?? task.priority;
    const clientName = task.client?.name ? ` · ${task.client.name}` : '';
    const fromName   = task.creator?.full_name ? ` — Dari: ${task.creator.full_name}` : '';
    await this.notifications.send({
      userId: assigneeId,
      type: 'task_assigned',
      title: `Tugas Baru — ${priorityLabel}`,
      body: `${task.title}${clientName}${fromName}`,
      data: { task_id: task.id, priority: task.priority },
    }).catch(() => null);
  }

  private async notifyBroadcastOffer(taskId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['client', 'creator'],
    });
    if (!task) return;
    const priorityLabel = PRIORITY_LABEL[task.priority] ?? task.priority;
    const clientName = task.client?.name ? ` · ${task.client.name}` : '';
    const fromName   = task.creator?.full_name ? ` — Dari: ${task.creator.full_name}` : '';
    await this.notifications.sendMany(
      userIds,
      'task_assigned',
      `Tugas Tersedia — ${priorityLabel}`,
      `${task.title}${clientName} (broadcast — siapa cepat)${fromName}`,
      { task_id: task.id, priority: task.priority, dispatch: 'broadcast' },
    ).catch(() => null);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CREATE
  // ────────────────────────────────────────────────────────────────────────────
  async create(creatorId: string, dto: CreateTaskDto): Promise<TaskEntity> {
    if (dto.dispatch_type === 'direct' && !dto.assigned_to) {
      throw new BadRequestException('assigned_to wajib diisi untuk dispatch direct.');
    }
    if (dto.dispatch_type === 'broadcast' && !dto.broadcast_dept_id) {
      throw new BadRequestException('broadcast_dept_id wajib diisi untuk dispatch broadcast.');
    }

    const task = this.taskRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type ?? null,
      priority: dto.priority as never,
      client_id: dto.client_id ?? null,
      location_id: dto.location_id ?? null,
      dispatch_type: dto.dispatch_type,
      broadcast_dept_id: dto.broadcast_dept_id ?? null,
      scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : null,
      is_emergency: dto.is_emergency ?? false,
      notes: dto.notes ?? null,
      template_id: dto.template_id ?? null,
      created_by: creatorId,
      status: 'unassigned',
    });

    const saved = await this.taskRepo.save(task);

    // Immediately dispatch
    if (dto.dispatch_type === 'direct' && dto.assigned_to) {
      await this.dispatch.offerTask(saved.id, dto.assigned_to);
      await this.notifyAssignee(saved.id, dto.assigned_to);
    } else {
      // Broadcast: offer to all members in dept — simplified: keep unassigned, offer in batch
      if (dto.broadcast_dept_id) {
        const members = await this.userRepo
          .createQueryBuilder('u')
          .where('u.dept_id = :deptId', { deptId: dto.broadcast_dept_id })
          .andWhere('u.is_active = true')
          .getMany();

        for (const member of members) {
          await this.assignRepo.save(
            this.assignRepo.create({
              task_id: saved.id,
              user_id: member.id,
              status: 'offered',
              offered_at: new Date(),
              is_current: false, // will be marked current when accepted
            }),
          );
        }
        await this.taskRepo.update(saved.id, { status: 'pending_confirmation' });
        await this.notifyBroadcastOffer(saved.id, members.map((m) => m.id));
      }
    }

    return this.taskRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['client', 'assignee', 'creator'],
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // LIST / DETAIL
  // ────────────────────────────────────────────────────────────────────────────
  async findAll(filters: {
    userId?: string;
    status?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.taskRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.client', 'c')
      .leftJoinAndSelect('t.assignee', 'assignee')
      .leftJoinAndSelect('t.creator', 'creator')
      .orderBy('t.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.userId) {
      qb.andWhere('(t.assigned_to = :uid OR t.created_by = :uid)', { uid: filters.userId });
    }
    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status });
    if (filters.priority) qb.andWhere('t.priority = :priority', { priority: filters.priority });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['client', 'assignee', 'creator', 'canceller', 'assignments', 'delegations'],
    });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan.');
    return task;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ACCEPT / REJECT
  // ────────────────────────────────────────────────────────────────────────────
  async accept(taskId: string, userId: string): Promise<TaskEntity> {
    const task = await this.findOne(taskId);

    if (!['pending_confirmation', 'unassigned'].includes(task.status)) {
      throw new BadRequestException('Tugas tidak dalam status yang dapat diterima.');
    }

    // For broadcast: mark this user's assignment as accepted, close others
    await this.assignRepo.update(
      { task_id: taskId, status: 'offered' },
      { status: 'rejected', responded_at: new Date() },
    );

    const assignment = await this.assignRepo.findOne({
      where: { task_id: taskId, user_id: userId },
    });

    if (assignment) {
      await this.assignRepo.update(assignment.id, {
        status: 'accepted',
        responded_at: new Date(),
        is_current: true,
      });
    } else {
      // Direct: create if not found
      await this.assignRepo.save(
        this.assignRepo.create({
          task_id: taskId,
          user_id: userId,
          status: 'accepted',
          offered_at: new Date(),
          responded_at: new Date(),
          is_current: true,
        }),
      );
    }

    await this.taskRepo.update(taskId, {
      assigned_to: userId,
      status: 'assigned',
      confirm_deadline: null,
    });

    const updated = await this.findOne(taskId);
    this.realtime?.emitTaskUpdated(taskId, { status: 'assigned', assigned_to: userId });
    return updated;
  }

  async reject(taskId: string, userId: string, dto: RejectTaskDto): Promise<void> {
    const task = await this.findOne(taskId);

    await this.assignRepo.update(
      { task_id: taskId, user_id: userId, is_current: true },
      {
        status: 'rejected',
        responded_at: new Date(),
        reject_reason: dto.reason ?? null,
        is_current: false,
      },
    );

    // Reset task to unassigned
    await this.taskRepo.update(taskId, {
      assigned_to: null,
      status: 'unassigned',
      confirm_deadline: null,
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DELEGATE
  // ────────────────────────────────────────────────────────────────────────────
  async delegate(taskId: string, fromUserId: string, dto: DelegateTaskDto): Promise<DelegationEntity> {
    const task = await this.findOne(taskId);

    if (task.assigned_to !== fromUserId) {
      throw new ForbiddenException('Hanya pemegang tugas yang dapat mendelegasikan.');
    }

    // Cek apakah role user memiliki hak delegasi
    const fromUser = await this.userRepo.findOne({
      where: { id: fromUserId },
      relations: ['role'],
    });
    if (!fromUser?.role?.can_delegate) {
      throw new ForbiddenException('Role Anda tidak memiliki hak untuk mendelegasikan tugas.');
    }

    // Pastikan target user bebas
    const targetOnVisit = await this.visitRepo.findOne({
      where: { user_id: dto.to_user_id, status: 'ongoing' },
    });
    if (targetOnVisit) {
      throw new BadRequestException('Teknisi tujuan sedang dalam kunjungan aktif.');
    }

    const delegation = this.delegationRepo.create({
      task_id: taskId,
      from_user_id: fromUserId,
      to_user_id: dto.to_user_id,
      type: dto.type ?? 'delegate',
      reason: dto.reason,
      status: 'pending',
      swap_task_id: dto.swap_task_id ?? null,
    });

    const saved = await this.delegationRepo.save(delegation);

    // Notif ke creator (pemberi tugas) untuk approval
    if (task.created_by && task.created_by !== fromUserId) {
      await this.notifications.send({
        userId: task.created_by,
        type: 'delegation_request',
        title: 'Permintaan Pelimpahan Tugas',
        body: `${fromUser.full_name} ingin melimpahkan "${task.title}". Alasan: ${dto.reason}.`,
        data: { task_id: taskId, delegation_id: saved.id },
      }).catch(() => null);
    }

    return saved;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ON HOLD
  // ────────────────────────────────────────────────────────────────────────────
  async holdTask(taskId: string, userId: string, dto: HoldTaskDto): Promise<TaskHoldEntity> {
    const task = await this.findOne(taskId);

    if (task.assigned_to !== userId) {
      throw new ForbiddenException('Hanya pemegang tugas yang dapat mengajukan penundaan.');
    }

    if (!['assigned', 'pending_confirmation', 'in_progress'].includes(task.status)) {
      throw new BadRequestException('Tugas tidak dalam status aktif untuk di-hold.');
    }

    const evidenceUrls = dto.evidence_urls ?? [];
    if (evidenceUrls.length > 5) {
      throw new BadRequestException('Maksimal 5 foto bukti.');
    }

    // Find visit if provided
    if (dto.visit_id) {
      const visit = await this.visitRepo.findOne({ where: { id: dto.visit_id } });
      if (!visit || visit.status !== 'ongoing') {
        throw new BadRequestException('Visit tidak ditemukan atau sudah selesai.');
      }
      // Set visit to on_hold
      await this.visitRepo.update(dto.visit_id, { status: 'on_hold' });
    }

    const autoApproveMinutes = HOLD_AUTO_APPROVE_MINUTES[task.priority] ?? 240;
    const autoApproveAt = new Date(Date.now() + autoApproveMinutes * 60_000);

    const hold = this.holdRepo.create({
      task_id: taskId,
      visit_id: dto.visit_id ?? null,
      held_by: userId,
      reason_type: dto.reason_type,
      reason_notes: dto.reason_notes,
      evidence_urls: evidenceUrls,
      auto_approve_at: autoApproveAt,
    });

    await this.taskRepo.update(taskId, { status: 'on_hold' });

    const savedHold = await this.holdRepo.save(hold);

    // Notif ke creator (pemberi tugas)
    if (task.created_by) {
      const holderName = task.assignee?.full_name ?? 'Teknisi';
      const reasonLabel = HOLD_REASON_LABELS[dto.reason_type] ?? dto.reason_type;
      await this.notifications.send({
        userId: task.created_by,
        type: 'task_on_hold',
        title: 'Pengajuan Tunda Tugas',
        body: `${holderName} mengajukan tunda "${task.title}". Alasan: ${reasonLabel}.`,
        data: { task_id: taskId, hold_id: savedHold.id },
      }).catch(() => null);
    }

    return savedHold;
  }

  async getHolds(taskId: string): Promise<TaskHoldEntity[]> {
    return this.holdRepo.find({
      where: { task_id: taskId },
      relations: ['holder', 'reviewer'],
      order: { created_at: 'DESC' },
    });
  }

  async approveHold(
    taskId: string,
    holdId: string,
    managerId: string,
    dto: ApproveHoldDto,
  ): Promise<TaskHoldEntity> {
    const hold = await this.holdRepo.findOneOrFail({ where: { id: holdId, task_id: taskId } });

    if (hold.review_status !== 'pending') {
      throw new BadRequestException('Hold sudah di-review.');
    }

    let newAssignedTo: string | null = null;
    if (dto.rescheduled_assign_to === 'same') {
      newAssignedTo = hold.held_by;
    } else if (dto.rescheduled_assign_to && dto.rescheduled_assign_to !== 'broadcast') {
      newAssignedTo = dto.rescheduled_assign_to;
    }

    await this.holdRepo.update(holdId, {
      review_status: 'approved',
      reviewed_by: managerId,
      reviewed_at: new Date(),
      reschedule_date: dto.reschedule_date,
      reschedule_note: dto.reschedule_note ?? null,
    });

    const taskUpdate: Partial<TaskEntity> = {
      status: 'rescheduled',
    };
    if (newAssignedTo) taskUpdate.assigned_to = newAssignedTo;

    await this.taskRepo.update(taskId, taskUpdate as never);

    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    await this.notifications.send({
      userId: hold.held_by,
      type: 'task_hold_approved',
      title: 'Penundaan Disetujui',
      body: `Penundaan tugas "${task?.title ?? ''}" disetujui.${dto.reschedule_date ? ` Dijadwal ulang: ${dto.reschedule_date}.` : ''}`,
      data: { task_id: taskId },
    }).catch(() => null);

    this.realtime?.emitTaskUpdated(taskId, { status: 'rescheduled' });
    return this.holdRepo.findOneOrFail({ where: { id: holdId } });
  }

  async rejectHold(
    taskId: string,
    holdId: string,
    managerId: string,
    dto: RejectHoldDto,
  ): Promise<TaskHoldEntity> {
    const hold = await this.holdRepo.findOneOrFail({ where: { id: holdId, task_id: taskId } });

    if (hold.review_status !== 'pending') {
      throw new BadRequestException('Hold sudah di-review.');
    }

    await this.holdRepo.update(holdId, {
      review_status: 'rejected',
      reviewed_by: managerId,
      reviewed_at: new Date(),
      reject_reason: dto.reason,
    });

    // Hold dari in_progress (ada visit aktif) → kembalikan ke in_progress,
    // bukan assigned, agar status task konsisten dengan visit yang sedang berjalan
    const restoreStatus = hold.visit_id ? 'in_progress' : 'assigned';
    await this.taskRepo.update(taskId, { status: restoreStatus });
    if (hold.visit_id) {
      await this.visitRepo.update(hold.visit_id, { status: 'ongoing' });
    }

    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    await this.notifications.send({
      userId: hold.held_by,
      type: 'task_hold_rejected',
      title: 'Penundaan Ditolak',
      body: `Penundaan tugas "${task?.title ?? ''}" ditolak. ${dto.reason ?? 'Lanjutkan pekerjaan.'}`,
      data: { task_id: taskId },
    }).catch(() => null);

    this.realtime?.emitTaskUpdated(taskId, { status: restoreStatus });
    return this.holdRepo.findOneOrFail({ where: { id: holdId } });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MANAGER DASHBOARDS
  // ────────────────────────────────────────────────────────────────────────────
  async getOnHoldTasks() {
    const tasks = await this.taskRepo.find({
      where: { status: 'on_hold' },
      relations: ['client', 'assignee'],
      order: { created_at: 'DESC' },
    });
    if (tasks.length === 0) return [];
    const holds = await this.holdRepo.find({
      where: { task_id: In(tasks.map((t) => t.id)), review_status: 'pending' },
      order: { created_at: 'ASC' },
    });
    const holdMap = new Map(holds.map((h) => [h.task_id, h]));
    return tasks.map((t) => ({ ...t, pending_hold: holdMap.get(t.id) ?? null }));
  }

  async getRescheduledTasks() {
    return this.taskRepo.find({
      where: { status: 'rescheduled' },
      relations: ['client', 'assignee'],
      order: { created_at: 'DESC' },
    });
  }

  async getPendingDelegations() {
    return this.delegationRepo.find({
      where: { status: 'pending' },
      relations: ['task', 'task.client', 'from_user', 'to_user'],
      order: { created_at: 'DESC' },
    });
  }

  async approveDelegation(delegationId: string, approverId: string) {
    const d = await this.delegationRepo.findOneOrFail({
      where: { id: delegationId },
      relations: ['task'],
    });

    await this.delegationRepo.update(delegationId, {
      status: 'accepted',
      approved_by: approverId,
      approved_at: new Date(),
    });

    if (d.type === 'swap' && d.swap_task_id) {
      // Tukar: task_id → to_user_id, swap_task_id → from_user_id
      await Promise.all([
        this.taskRepo.update(d.task_id, { assigned_to: d.to_user_id }),
        this.taskRepo.update(d.swap_task_id, { assigned_to: d.from_user_id }),
      ]);
      await this.notifyAssignee(d.task_id, d.to_user_id);
      await this.notifyAssignee(d.swap_task_id, d.from_user_id);
    } else {
      await this.taskRepo.update(d.task_id, { assigned_to: d.to_user_id });
      await this.notifyAssignee(d.task_id, d.to_user_id);
    }

    return this.delegationRepo.findOneOrFail({ where: { id: delegationId } });
  }

  async rejectDelegation(delegationId: string, approverId: string, reason?: string) {
    const d = await this.delegationRepo.findOneOrFail({
      where: { id: delegationId },
      relations: ['task'],
    });

    await this.delegationRepo.update(delegationId, {
      status: 'rejected',
      approved_by: approverId,
      approved_at: new Date(),
      reject_reason: reason ?? null,
    });

    // Notif ke teknisi yang mengajukan limpah
    await this.notifications.send({
      userId: d.from_user_id,
      type: 'delegation_rejected',
      title: 'Permintaan Limpah Ditolak',
      body: `Pelimpahan tugas "${d.task?.title ?? ''}" ditolak.${reason ? ` Alasan: ${reason}` : ' Lanjutkan pekerjaan.'}`,
      data: { task_id: d.task_id },
    }).catch(() => null);

    return this.delegationRepo.findOneOrFail({ where: { id: delegationId } });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ADMIN ASSIGN (force-assign oleh admin/manager)
  // ────────────────────────────────────────────────────────────────────────────
  async assign(
    taskId: string,
    body: { user_id?: string; dept_id?: string },
  ): Promise<TaskEntity> {
    const task = await this.findOne(taskId);

    if (!['unassigned', 'pending_confirmation', 'assigned', 'rescheduled'].includes(task.status)) {
      throw new BadRequestException('Tugas tidak dapat di-assign pada status ini.');
    }

    if (!body.user_id && !body.dept_id) {
      throw new BadRequestException('user_id atau dept_id wajib diisi.');
    }

    // Revoke previous assignments
    await this.assignRepo.update(
      { task_id: taskId },
      { is_current: false, status: 'rejected', responded_at: new Date() },
    );

    // ── BROADCAST ke departemen ────────────────────────────────────────────────
    if (body.dept_id) {
      const members = await this.userRepo
        .createQueryBuilder('u')
        .where('u.dept_id = :deptId', { deptId: body.dept_id })
        .andWhere('u.is_active = true')
        .getMany();

      if (members.length === 0) {
        throw new BadRequestException('Departemen tidak memiliki anggota aktif.');
      }

      for (const member of members) {
        await this.assignRepo.save(
          this.assignRepo.create({
            task_id: taskId,
            user_id: member.id,
            status: 'offered',
            offered_at: new Date(),
            is_current: false,
          }),
        );
      }

      await this.taskRepo.update(taskId, {
        assigned_to: null,
        dispatch_type: 'broadcast',
        broadcast_dept_id: body.dept_id,
        status: 'pending_confirmation',
        confirm_deadline: null,
      });

      const result = await this.findOne(taskId);
      this.realtime?.emitTaskUpdated(taskId, { status: 'pending_confirmation' });
      await this.notifyBroadcastOffer(taskId, members.map((m) => m.id));
      return result;
    }

    // ── DIRECT ke individu ─────────────────────────────────────────────────────
    const toUser = await this.userRepo.findOne({ where: { id: body.user_id, is_active: true } });
    if (!toUser) throw new NotFoundException('Teknisi tujuan tidak ditemukan.');

    await this.assignRepo.save(
      this.assignRepo.create({
        task_id: taskId,
        user_id: body.user_id,
        status: 'accepted',
        offered_at: new Date(),
        responded_at: new Date(),
        is_current: true,
      }),
    );

    await this.taskRepo.update(taskId, {
      assigned_to: body.user_id,
      dispatch_type: 'direct',
      broadcast_dept_id: null,
      status: 'assigned',
      confirm_deadline: null,
    });

    const result = await this.findOne(taskId);
    this.realtime?.emitTaskUpdated(taskId, { status: 'assigned', assigned_to: body.user_id });
    await this.notifyAssignee(taskId, body.user_id!);
    return result;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SWAP REQUEST (tukar tugas antar teknisi — perlu approval manajer)
  // ────────────────────────────────────────────────────────────────────────────
  async swapRequest(taskId: string, fromUserId: string, dto: SwapRequestDto): Promise<DelegationEntity> {
    const task = await this.findOne(taskId);

    if (!['assigned', 'pending_confirmation'].includes(task.status)) {
      throw new BadRequestException('Swap hanya dapat dilakukan pada tugas yang sedang aktif.');
    }

    if (task.assigned_to !== fromUserId) {
      throw new ForbiddenException('Hanya pemegang tugas yang dapat mengajukan swap.');
    }

    if (dto.to_user_id === fromUserId) {
      throw new BadRequestException('Tidak dapat swap dengan diri sendiri.');
    }

    // Validasi swap_task_id milik to_user_id
    const swapTask = await this.taskRepo.findOne({
      where: { id: dto.swap_task_id, assigned_to: dto.to_user_id },
    });

    if (!swapTask) {
      throw new BadRequestException('Tugas yang ingin ditukar tidak ditemukan atau bukan milik teknisi tujuan.');
    }

    if (!['assigned', 'pending_confirmation'].includes(swapTask.status)) {
      throw new BadRequestException('Tugas yang ingin ditukar tidak dalam status aktif.');
    }

    const delegation = this.delegationRepo.create({
      task_id: taskId,
      from_user_id: fromUserId,
      to_user_id: dto.to_user_id,
      type: 'swap',
      reason: dto.reason,
      status: 'pending',
      swap_task_id: dto.swap_task_id,
    });

    return this.delegationRepo.save(delegation);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CANCEL (admin / super_admin — pembatalan tugas, soft)
  // ────────────────────────────────────────────────────────────────────────────
  async cancel(taskId: string, userId: string, dto: CancelTaskDto): Promise<TaskEntity> {
    const task = await this.findOne(taskId);

    if (task.status === 'cancelled') {
      throw new BadRequestException('Tugas sudah dibatalkan.');
    }
    if (task.status === 'completed') {
      throw new BadRequestException('Tugas yang sudah selesai tidak dapat dibatalkan.');
    }

    const previousAssignee = task.assigned_to;

    await this.taskRepo.update(taskId, {
      status: 'cancelled',
      cancelled_at: new Date(),
      cancelled_by: userId,
      cancel_reason: dto.reason,
    });

    // Tutup semua penugasan aktif — tidak ada lagi offered/accepted yang current
    await this.assignRepo.update(
      { task_id: taskId, is_current: true },
      { is_current: false },
    );

    // Batalkan visit yang masih berjalan (jika ada) supaya teknisi tidak bisa check-out lagi
    await this.visitRepo.update(
      { task_id: taskId, status: 'ongoing' },
      { status: 'cancelled' },
    );
    await this.visitRepo.update(
      { task_id: taskId, status: 'on_hold' },
      { status: 'cancelled' },
    );

    // Notif ke assignee kalau ada
    if (previousAssignee) {
      await this.notifications.send({
        userId: previousAssignee,
        type: 'task_cancelled',
        title: 'Tugas Dibatalkan',
        body: `${task.title} dibatalkan oleh admin. Alasan: ${dto.reason}`,
        data: { task_id: taskId },
      }).catch(() => null);
    }

    // Notif ke creator kalau beda dari yang cancel dan beda dari assignee
    if (
      task.created_by &&
      task.created_by !== userId &&
      task.created_by !== previousAssignee
    ) {
      await this.notifications.send({
        userId: task.created_by,
        type: 'task_cancelled',
        title: 'Tugas Anda Dibatalkan',
        body: `${task.title} dibatalkan oleh admin. Alasan: ${dto.reason}`,
        data: { task_id: taskId },
      }).catch(() => null);
    }

    this.realtime?.emitTaskUpdated(taskId, {
      status: 'cancelled',
      cancel_reason: dto.reason,
    });

    return this.findOne(taskId);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // HARD DELETE (super_admin only) — cascade ke assignments/delegations/holds,
  // visits.task_id di-set NULL oleh FK.
  // ────────────────────────────────────────────────────────────────────────────
  async remove(taskId: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan.');

    await this.taskRepo.delete(taskId);
    this.realtime?.emitTaskUpdated(taskId, { status: 'deleted' });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // HANDOVER (delegasi darurat — langsung tanpa approval)
  // ────────────────────────────────────────────────────────────────────────────
  async handover(taskId: string, fromUserId: string, dto: HandoverTaskDto): Promise<TaskEntity> {
    const task = await this.findOne(taskId);

    if (!['assigned', 'in_progress', 'pending_confirmation'].includes(task.status)) {
      throw new BadRequestException('Handover hanya dapat dilakukan pada tugas yang sedang aktif.');
    }

    if (task.assigned_to !== fromUserId) {
      throw new ForbiddenException('Hanya pemegang tugas yang dapat melakukan handover.');
    }

    const toUser = await this.userRepo.findOne({
      where: { id: dto.to_user_id, is_active: true },
    });
    if (!toUser) throw new NotFoundException('Teknisi tujuan tidak ditemukan.');

    if (dto.to_user_id === fromUserId) {
      throw new BadRequestException('Tidak dapat melakukan handover ke diri sendiri.');
    }

    // Catat sebagai delegation dengan type 'delegate' dan langsung approved
    const delegation = this.delegationRepo.create({
      task_id: taskId,
      from_user_id: fromUserId,
      to_user_id: dto.to_user_id,
      type: 'delegate',
      reason: dto.reason,
      status: 'accepted', // immediate — no approval needed
      approved_by: fromUserId,
      approved_at: new Date(),
    });
    await this.delegationRepo.save(delegation);

    // Update current assignment
    await this.assignRepo.update(
      { task_id: taskId, user_id: fromUserId, is_current: true },
      { is_current: false },
    );

    await this.assignRepo.save(
      this.assignRepo.create({
        task_id: taskId,
        user_id: dto.to_user_id,
        status: 'accepted',
        offered_at: new Date(),
        responded_at: new Date(),
        is_current: true,
      }),
    );

    // Transfer ongoing visit to new assignee if any
    const ongoingVisit = await this.visitRepo.findOne({
      where: { task_id: taskId, user_id: fromUserId, status: 'ongoing' },
    });
    if (ongoingVisit) {
      await this.visitRepo.update(ongoingVisit.id, { user_id: dto.to_user_id });
    }

    await this.taskRepo.update(taskId, { assigned_to: dto.to_user_id });

    const result = await this.findOne(taskId);
    this.realtime?.emitTaskUpdated(taskId, {
      status: result.status,
      assigned_to: dto.to_user_id,
      handover_reason: dto.reason,
    });
    await this.notifyAssignee(taskId, dto.to_user_id);
    return result;
  }
}
