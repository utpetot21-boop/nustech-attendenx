import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { LeaveRequestEntity } from './entities/leave-request.entity';
import { LeaveBalanceLogEntity } from './entities/leave-balance-log.entity';
import { PendingDeductionEntity } from './entities/pending-deduction.entity';
import { LeaveObjectionEntity } from './entities/leave-objection.entity';
import { CompanyLeaveConfigEntity } from './entities/company-leave-config.entity';
import { UserEntity } from '../users/entities/user.entity';
import { NationalHolidayEntity } from '../schedule/entities/national-holiday.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveDto } from './dto/review-leave.dto';
import { CreateObjectionDto } from './dto/create-objection.dto';
import { NotificationsService } from '../notifications/notifications.service';

const LEAVE_TYPE_LABEL: Record<string, string> = {
  cuti: 'Cuti', izin: 'Izin', sakit: 'Sakit', dinas: 'Dinas',
};

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveBalanceEntity)
    private readonly balanceRepo: Repository<LeaveBalanceEntity>,
    @InjectRepository(LeaveRequestEntity)
    private readonly requestRepo: Repository<LeaveRequestEntity>,
    @InjectRepository(LeaveBalanceLogEntity)
    private readonly logRepo: Repository<LeaveBalanceLogEntity>,
    @InjectRepository(PendingDeductionEntity)
    private readonly deductionRepo: Repository<PendingDeductionEntity>,
    @InjectRepository(LeaveObjectionEntity)
    private readonly objectionRepo: Repository<LeaveObjectionEntity>,
    @InjectRepository(CompanyLeaveConfigEntity)
    private readonly configRepo: Repository<CompanyLeaveConfigEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(NationalHolidayEntity)
    private readonly holidayRepo: Repository<NationalHolidayEntity>,
    private readonly notifService: NotificationsService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  // BALANCE
  // ────────────────────────────────────────────────────────────────────────────
  async getBalance(userId: string, year?: number): Promise<LeaveBalanceEntity> {
    const y = year ?? new Date().getFullYear();
    let balance = await this.balanceRepo.findOne({ where: { user_id: userId, year: y } });
    if (!balance) {
      balance = this.balanceRepo.create({ user_id: userId, year: y, balance_days: 0 });
      await this.balanceRepo.save(balance);
    }
    return balance;
  }

  async getAllBalances(year?: number): Promise<LeaveBalanceEntity[]> {
    const y = year ?? new Date().getFullYear();
    return this.balanceRepo.find({ where: { year: y }, relations: ['user'], order: { updated_at: 'DESC' } });
  }

  async manualAdjust(userId: string, amount: number, notes: string, year?: number): Promise<void> {
    const balance = await this.getBalance(userId, year);
    const newBalance = Number(balance.balance_days) + amount;
    await this.balanceRepo.update(balance.id, { balance_days: newBalance });
    await this.writeLog(userId, 'manual_adjustment', amount, newBalance, undefined, notes);
  }

  async deleteLog(logId: string): Promise<void> {
    const log = await this.logRepo.findOneOrFail({ where: { id: logId } });
    if (log.type !== 'manual_adjustment') {
      throw new BadRequestException('Hanya log penyesuaian manual yang dapat dihapus.');
    }
    const balance = await this.getBalance(log.user_id);
    const newBalance = Number(balance.balance_days) - log.amount;
    await this.balanceRepo.update(balance.id, { balance_days: newBalance });
    await this.logRepo.delete(logId);
  }

  async getBalanceLogs(userId: string): Promise<LeaveBalanceLogEntity[]> {
    return this.logRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 50,
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // LEAVE REQUESTS
  // ────────────────────────────────────────────────────────────────────────────
  async createRequest(userId: string, dto: CreateLeaveRequestDto): Promise<LeaveRequestEntity> {
    const totalDays = await this.countWorkDays(dto.start_date, dto.end_date);
    if (totalDays <= 0) {
      throw new BadRequestException('Rentang tanggal tidak valid atau tidak ada hari kerja.');
    }

    // Cek tumpang tindih dengan pengajuan yang sudah ada (pending/approved)
    const overlap = await this.requestRepo.findOne({
      where: {
        user_id: userId,
        status: In(['pending', 'approved']),
        start_date: LessThanOrEqual(dto.end_date),
        end_date: MoreThanOrEqual(dto.start_date),
      },
    });
    if (overlap) {
      throw new BadRequestException(
        `Terdapat pengajuan yang tumpang tindih (${overlap.start_date} → ${overlap.end_date}, status: ${overlap.status}).`,
      );
    }

    // Validasi surat dokter untuk sakit ≥ 3 hari
    if (dto.type === 'sakit' && totalDays >= 3 && !dto.attachment_url) {
      throw new BadRequestException(
        'Pengajuan sakit ≥ 3 hari kerja wajib melampirkan surat keterangan dokter.',
      );
    }

    if (dto.type === 'cuti') {
      const balance = await this.getBalance(userId);
      if (Number(balance.balance_days) < totalDays) {
        throw new BadRequestException(
          `Saldo cuti tidak mencukupi. Saldo: ${balance.balance_days} hari, diperlukan: ${totalDays} hari.`,
        );
      }
    }

    const request = this.requestRepo.create({
      user_id: userId,
      type: dto.type,
      start_date: dto.start_date,
      end_date: dto.end_date,
      total_days: totalDays,
      reason: dto.reason,
      attachment_url: dto.attachment_url ?? null,
      status: 'pending',
    });

    const saved = await this.requestRepo.save(request);

    // Notifikasi ke semua approver (can_approve=true)
    const requester = await this.userRepo.findOne({ where: { id: userId } });
    const approvers = await this.userRepo.find({
      where: { is_active: true },
      relations: ['role'],
    });
    const approverIds = approvers.filter((u) => u.role?.can_approve).map((u) => u.id);
    if (approverIds.length > 0) {
      const typeLabel = LEAVE_TYPE_LABEL[dto.type] ?? dto.type;
      this.notifService
        .sendMany(
          approverIds,
          'leave_request',
          `Pengajuan ${typeLabel} Baru`,
          `${requester?.full_name ?? 'Karyawan'} mengajukan ${typeLabel} ${dto.start_date === dto.end_date ? dto.start_date : `${dto.start_date} s/d ${dto.end_date}`}`,
          { leave_request_id: saved.id },
        )
        .catch(() => null);
    }

    return saved;
  }

  async getRequests(filters: {
    userId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const qb = this.requestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .leftJoinAndSelect('r.approver', 'approver')
      .orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.userId) qb.andWhere('r.user_id = :uid', { uid: filters.userId });
    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  private async assertCanApprove(managerId: string): Promise<void> {
    const manager = await this.userRepo.findOne({
      where: { id: managerId },
      relations: ['role'],
    });
    if (!manager?.role?.can_approve) {
      throw new ForbiddenException('Role Anda tidak memiliki hak untuk menyetujui pengajuan cuti.');
    }
  }

  async approveRequest(requestId: string, managerId: string): Promise<LeaveRequestEntity> {
    await this.assertCanApprove(managerId);
    const req = await this.findRequest(requestId);
    if (req.status !== 'pending') {
      throw new BadRequestException('Pengajuan sudah diproses.');
    }

    if (req.type === 'cuti') {
      const balance = await this.getBalance(req.user_id);
      const newBalance = Number(balance.balance_days) - (req.total_days ?? 0);
      if (newBalance < 0) {
        throw new BadRequestException('Saldo cuti tidak cukup saat approval.');
      }
      await this.balanceRepo.update(balance.id, {
        balance_days: newBalance,
        used_days: Number(balance.used_days) + (req.total_days ?? 0),
      });
      await this.writeLog(req.user_id, 'used', -(req.total_days ?? 0), newBalance, req.id);
    }

    await this.requestRepo.update(requestId, {
      status: 'approved',
      approved_by: managerId,
      approved_at: new Date(),
    });

    const approved = await this.findRequest(requestId);
    const typeLabel = LEAVE_TYPE_LABEL[approved.type] ?? approved.type;
    this.notifService
      .send({
        userId: approved.user_id,
        type: 'leave_approved',
        title: `${typeLabel} Disetujui`,
        body: `Pengajuan ${typeLabel} Anda ${approved.start_date === approved.end_date ? approved.start_date : `${approved.start_date} s/d ${approved.end_date}`} telah disetujui.`,
        data: { leave_request_id: approved.id },
      })
      .catch(() => null);

    return approved;
  }

  async rejectRequest(
    requestId: string,
    managerId: string,
    dto: RejectLeaveDto,
  ): Promise<LeaveRequestEntity> {
    await this.assertCanApprove(managerId);
    const req = await this.findRequest(requestId);
    if (req.status !== 'pending') throw new BadRequestException('Pengajuan sudah diproses.');

    await this.requestRepo.update(requestId, {
      status: 'rejected',
      approved_by: managerId,
      approved_at: new Date(),
      reject_reason: dto.reason,
    });

    const rejected = await this.findRequest(requestId);
    const typeLabel = LEAVE_TYPE_LABEL[rejected.type] ?? rejected.type;
    this.notifService
      .send({
        userId: rejected.user_id,
        type: 'leave_rejected',
        title: `${typeLabel} Ditolak`,
        body: `Pengajuan ${typeLabel} Anda ${rejected.start_date === rejected.end_date ? rejected.start_date : `${rejected.start_date} s/d ${rejected.end_date}`} ditolak. Alasan: ${dto.reason}`,
        data: { leave_request_id: rejected.id },
      })
      .catch(() => null);

    return rejected;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // OBJECTIONS
  // ────────────────────────────────────────────────────────────────────────────
  async createObjection(userId: string, dto: CreateObjectionDto): Promise<LeaveObjectionEntity> {
    const deduction = await this.deductionRepo.findOne({
      where: { id: dto.pending_deduction_id, user_id: userId },
    });

    if (!deduction) throw new NotFoundException('Pemotongan tidak ditemukan.');
    if (deduction.status !== 'pending') {
      throw new BadRequestException('Pemotongan sudah dieksekusi atau dibatalkan.');
    }
    if (new Date() > deduction.deadline_at) {
      throw new BadRequestException('Batas waktu keberatan sudah lewat.');
    }

    const existing = await this.objectionRepo.findOne({
      where: { pending_deduction_id: dto.pending_deduction_id },
    });
    if (existing) throw new BadRequestException('Keberatan sudah diajukan sebelumnya.');

    const objection = this.objectionRepo.create({
      pending_deduction_id: dto.pending_deduction_id,
      user_id: userId,
      reason: dto.reason,
      evidence_url: dto.evidence_url ?? null,
      status: 'pending',
    });

    return this.objectionRepo.save(objection);
  }

  async getObjections(userId?: string): Promise<LeaveObjectionEntity[]> {
    const qb = this.objectionRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u')
      .leftJoinAndSelect('o.reviewer', 'reviewer')
      .orderBy('o.created_at', 'DESC');

    if (userId) qb.andWhere('o.user_id = :uid', { uid: userId });

    return qb.getMany();
  }

  async approveObjection(objectionId: string, managerId: string): Promise<void> {
    const objection = await this.objectionRepo.findOneOrFail({ where: { id: objectionId } });
    if (objection.status !== 'pending') throw new BadRequestException('Keberatan sudah diproses.');

    await this.objectionRepo.update(objectionId, {
      status: 'approved',
      reviewed_by: managerId,
      reviewed_at: new Date(),
    });

    await this.deductionRepo.update(objection.pending_deduction_id, { status: 'cancelled' });

    const balance = await this.getBalance(objection.user_id);
    await this.writeLog(
      objection.user_id,
      'objection_cancel',
      0,
      Number(balance.balance_days),
      objectionId,
      'Keberatan alfa disetujui — saldo tidak berubah',
    );
  }

  async rejectObjection(objectionId: string, managerId: string, reason: string): Promise<void> {
    const objection = await this.objectionRepo.findOneOrFail({ where: { id: objectionId } });
    if (objection.status !== 'pending') throw new BadRequestException('Keberatan sudah diproses.');

    await this.objectionRepo.update(objectionId, {
      status: 'rejected',
      reviewed_by: managerId,
      reviewed_at: new Date(),
      reject_reason: reason,
    });

    // Execute deduction immediately
    const deduction = await this.deductionRepo.findOneOrFail({
      where: { id: objection.pending_deduction_id },
    });

    if (deduction.status === 'pending') {
      await this.executeDeduction(deduction.id, 'alfa_deduction');
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ALFA DEDUCTION ENGINE (called by alfa-detector job)
  // ────────────────────────────────────────────────────────────────────────────
  async processAlfa(userId: string, attendanceId: string): Promise<void> {
    const balance = await this.getBalance(userId);
    const config = await this.getConfig();
    const objectionWindowHours = config.objection_window_hours ?? 24;

    if (Number(balance.balance_days) > 0) {
      // Skenario A: buat pending_deduction
      const deadline = new Date(Date.now() + objectionWindowHours * 3_600_000);
      await this.deductionRepo.save(
        this.deductionRepo.create({
          user_id: userId,
          attendance_id: attendanceId,
          amount: 1,
          status: 'pending',
          deadline_at: deadline,
        }),
      );
    }
    // Skenario B (saldo = 0): attendance_violations dibuat oleh alfa-detector job
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ACCRUAL — called by cron jobs
  // ────────────────────────────────────────────────────────────────────────────
  async runMonthlyAccrual(): Promise<void> {
    const config = await this.getConfig();
    const maxDays = config.max_leave_days_per_year ?? 12;
    const monthlyAmount = config.monthly_accrual_amount ?? 1;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const users = await this.userRepo.find({ where: { is_active: true } });

    for (const user of users) {
      const balance = await this.getBalance(user.id, year);
      if (balance.last_accrual_month === month) continue; // already accrued this month

      if (Number(balance.balance_days) >= maxDays) {
        await this.writeLog(user.id, 'accrual_skipped', 0, Number(balance.balance_days),
          undefined, 'Saldo sudah maksimum');
      } else {
        const newBalance = Math.min(Number(balance.balance_days) + monthlyAmount, maxDays);
        await this.balanceRepo.update(balance.id, {
          balance_days: newBalance,
          accrued_monthly: balance.accrued_monthly + monthlyAmount,
          last_accrual_month: month,
          last_accrual_date: now.toISOString().split('T')[0],
        });
        await this.writeLog(user.id, 'accrual_monthly', monthlyAmount, newBalance);
      }
    }
  }

  async runYearEndExpiry(): Promise<void> {
    const year = new Date().getFullYear();
    const balances = await this.balanceRepo.find({ where: { year } });

    for (const balance of balances) {
      if (Number(balance.balance_days) <= 0) continue;
      const expired = Number(balance.balance_days);
      await this.balanceRepo.update(balance.id, {
        expired_days: Number(balance.expired_days) + expired,
        balance_days: 0,
      });
      await this.writeLog(balance.user_id, 'expired', -expired, 0, undefined,
        `Saldo ${expired} hari hangus 31 Desember`);
    }
  }

  async runPendingDeductionExecutor(): Promise<void> {
    const now = new Date();
    const overdue = await this.deductionRepo.find({
      where: { status: 'pending', deadline_at: LessThanOrEqual(now) },
    });

    for (const deduction of overdue) {
      const hasObjection = await this.objectionRepo.findOne({
        where: { pending_deduction_id: deduction.id, status: 'pending' },
      });
      if (hasObjection) continue; // wait for manager review

      await this.executeDeduction(deduction.id, 'alfa_deduction');
    }
  }

  async creditHolidayWork(userId: string): Promise<void> {
    const config = await this.getConfig();
    const credit = config.holiday_work_credit ?? 1;
    const year = new Date().getFullYear();
    const balance = await this.getBalance(userId, year);
    const newBalance = Number(balance.balance_days) + credit;
    await this.balanceRepo.update(balance.id, {
      balance_days: newBalance,
      accrued_holiday: balance.accrued_holiday + credit,
    });
    await this.writeLog(userId, 'accrual_holiday', credit, newBalance, undefined,
      'Kompensasi kerja di hari libur nasional');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────────────────────────────────
  private async countWorkDays(startDate: string, endDate: string): Promise<number> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return 0;

    const year = start.getFullYear();
    const holidays = await this.holidayRepo.find({
      where: { year, is_active: true },
    });
    const holidaySet = new Set(holidays.map((h) => h.date));

    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      const dow = cursor.getDay();
      const dateStr = cursor.toISOString().split('T')[0];
      if (dow !== 0 && dow !== 6 && !holidaySet.has(dateStr)) {
        count++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  private async executeDeduction(deductionId: string, logType: import('@nustech/shared').LeaveLogType): Promise<void> {
    const deduction = await this.deductionRepo.findOneOrFail({ where: { id: deductionId } });
    const balance = await this.getBalance(deduction.user_id);
    const newBalance = Math.max(0, Number(balance.balance_days) - Number(deduction.amount));
    await this.balanceRepo.update(balance.id, { balance_days: newBalance });
    await this.deductionRepo.update(deductionId, {
      status: logType === 'alfa_deduction' ? 'auto_executed' : 'executed',
      executed_at: new Date(),
    });
    await this.writeLog(deduction.user_id, logType, -Number(deduction.amount), newBalance,
      deductionId);
  }

  private async writeLog(
    userId: string,
    type: import('@nustech/shared').LeaveLogType,
    amount: number,
    balanceAfter: number,
    referenceId?: string,
    notes?: string,
  ): Promise<void> {
    await this.logRepo.save(
      this.logRepo.create({ user_id: userId, type, amount, balance_after: balanceAfter,
        reference_id: referenceId ?? null, notes: notes ?? null }),
    );
  }

  private async getConfig(): Promise<CompanyLeaveConfigEntity> {
    const cfgs = await this.configRepo.find({ order: { effective_date: 'DESC' }, take: 1 });
    const cfg = cfgs[0] ?? null;
    return cfg ?? this.configRepo.create({});
  }

  private async findRequest(id: string): Promise<LeaveRequestEntity> {
    const req = await this.requestRepo.findOne({ where: { id }, relations: ['user'] });
    if (!req) throw new NotFoundException('Pengajuan cuti tidak ditemukan.');
    return req;
  }
}
