import {
  BadRequestException, ForbiddenException,
  Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ExpenseClaimEntity } from './entities/expense-claim.entity';
import { ExpenseConfigEntity } from './entities/expense-config.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CreateClaimDto } from './dto/create-claim.dto';
import { ReviewClaimDto, ReviewAction } from './dto/review-claim.dto';
import { StorageService } from '../../services/storage.service';
import { NotificationsService } from '../notifications/notifications.service';

const CATEGORY_LABEL: Record<string, string> = {
  transport: 'Transport',
  parkir:    'Parkir',
  material:  'Material',
  konsumsi:  'Konsumsi',
  akomodasi: 'Akomodasi',
  lainnya:   'Lainnya',
};

@Injectable()
export class ExpenseClaimsService {
  private readonly logger = new Logger(ExpenseClaimsService.name);

  constructor(
    @InjectRepository(ExpenseClaimEntity)
    private readonly claimRepo: Repository<ExpenseClaimEntity>,
    @InjectRepository(ExpenseConfigEntity)
    private readonly configRepo: Repository<ExpenseConfigEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectDataSource()
    private readonly ds: DataSource,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Upload receipt foto ────────────────────────────────────────────────────
  async uploadReceipt(buffer: Buffer, mimeType: string): Promise<string> {
    return this.storage.upload('receipts', 'jpg', buffer, mimeType);
  }

  // ── List config kategori ───────────────────────────────────────────────────
  getConfig() {
    return this.configRepo.find({ order: { category: 'ASC' } });
  }

  async updateConfig(category: string, maxAmount: number, receiptAbove: number) {
    await this.configRepo.update({ category }, {
      max_amount: maxAmount,
      receipt_required_above: receiptAbove,
    });
    return this.configRepo.findOneBy({ category });
  }

  // ── Buat klaim ─────────────────────────────────────────────────────────────
  async create(userId: string, dto: CreateClaimDto): Promise<ExpenseClaimEntity> {
    const cfg = await this.configRepo.findOneBy({ category: dto.category });
    if (!cfg || !cfg.is_active) throw new BadRequestException('Kategori tidak aktif');
    if (dto.amount > cfg.max_amount) {
      throw new BadRequestException(`Melebihi batas maksimum kategori ${cfg.category}: Rp ${cfg.max_amount.toLocaleString('id-ID')}`);
    }
    if (dto.amount >= cfg.receipt_required_above && (!dto.receipt_urls || dto.receipt_urls.length === 0)) {
      throw new BadRequestException(`Foto nota wajib untuk nominal ≥ Rp ${cfg.receipt_required_above.toLocaleString('id-ID')}`);
    }

    const claim = this.claimRepo.create({
      user_id: userId,
      visit_id: dto.visit_id ?? null,
      category: dto.category,
      amount: dto.amount,
      description: dto.description ?? null,
      receipt_urls: dto.receipt_urls ?? [],
    });

    const saved = await this.claimRepo.save(claim);

    // Generate nomor klaim KC-YYYY/NNN
    const number = await this.generateClaimNumber(saved.id);
    saved.claim_number = number;

    // Notifikasi ke Accounting (jabatan ACCOUNTING) saja, kecuali pemohon sendiri
    try {
      const requester = await this.userRepo.findOne({ where: { id: userId } });
      const approverIds = await this.notifications.getApproversByPosition('ACCOUNTING', userId);

      if (approverIds.length > 0) {
        const catLabel = CATEGORY_LABEL[dto.category] ?? dto.category;
        await this.notifications.sendMany(
          approverIds,
          'expense_claim_submitted',
          'Klaim Biaya Baru',
          `${requester?.full_name ?? 'Karyawan'} mengajukan klaim ${catLabel} sebesar Rp ${dto.amount.toLocaleString('id-ID')}.`,
          { expense_claim_id: saved.id, category: dto.category },
        );
        this.logger.log(
          `[expense_claim_submitted] saved=${saved.id} requester=${userId} accounting=${approverIds.length}`,
        );
      }
    } catch (err) {
      this.logger.error(`[expense_claim_submitted] notif gagal: ${err}`);
    }

    return saved;
  }

  // ── List semua (admin/manager) ─────────────────────────────────────────────
  findAll(filters: { status?: string; userId?: string; month?: string }) {
    const qb = this.claimRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .leftJoinAndSelect('c.reviewer', 'r')
      .orderBy('c.created_at', 'DESC');

    if (filters.status) qb.andWhere('c.status = :status', { status: filters.status });
    if (filters.userId) qb.andWhere('c.user_id = :uid', { uid: filters.userId });
    if (filters.month) {
      const [y, m] = filters.month.split('-').map(Number);
      qb.andWhere('EXTRACT(YEAR FROM c.created_at) = :y', { y });
      qb.andWhere('EXTRACT(MONTH FROM c.created_at) = :m', { m });
    }
    return qb.getMany();
  }

  // ── List milik user ───────────────────────────────────────────────────────
  findMine(userId: string, status?: string) {
    const qb = this.claimRepo.createQueryBuilder('c')
      .where('c.user_id = :uid', { uid: userId })
      .orderBy('c.created_at', 'DESC');
    if (status) qb.andWhere('c.status = :status', { status });
    return qb.getMany();
  }

  // ── Rekap payroll per kategori ────────────────────────────────────────────
  async getPayrollSummary(month: string) {
    const [y, m] = month.split('-').map(Number);
    return this.ds.query(
      `SELECT
         u.full_name, d.name AS department,
         SUM(c.amount) FILTER (WHERE c.category = 'transport')  AS transport,
         SUM(c.amount) FILTER (WHERE c.category = 'parkir')     AS parkir,
         SUM(c.amount) FILTER (WHERE c.category = 'material')   AS material,
         SUM(c.amount) FILTER (WHERE c.category = 'konsumsi')   AS konsumsi,
         SUM(c.amount) FILTER (WHERE c.category = 'akomodasi')  AS akomodasi,
         SUM(c.amount) FILTER (WHERE c.category = 'lainnya')    AS lainnya,
         SUM(c.amount) AS total
       FROM expense_claims c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN departments d ON u.dept_id = d.id
       WHERE c.status IN ('approved','paid')
         AND EXTRACT(YEAR FROM c.created_at) = $1
         AND EXTRACT(MONTH FROM c.created_at) = $2
       GROUP BY u.full_name, d.name
       ORDER BY d.name, u.full_name`,
      [y, m],
    );
  }

  // ── Export Payroll XLSX ───────────────────────────────────────────────────
  async exportPayrollXlsx(month: string): Promise<Buffer> {
    const rows = await this.getPayrollSummary(month);
    const cols = ['transport', 'parkir', 'material', 'konsumsi', 'akomodasi', 'lainnya'];

    const wsData = [
      [`Rekap Klaim Biaya — ${month}`],
      [],
      ['Karyawan', 'Departemen', 'Transport', 'Parkir', 'Material', 'Konsumsi', 'Akomodasi', 'Lainnya', 'TOTAL'],
      ...rows.map((r: any) => [
        r.full_name,
        r.department ?? '—',
        ...cols.map((c) => Number(r[c] ?? 0)),
        Number(r.total ?? 0),
      ]),
      ['TOTAL', '',
        ...cols.map((c) => rows.reduce((s: number, r: any) => s + Number(r[c] ?? 0), 0)),
        rows.reduce((s: number, r: any) => s + Number(r.total ?? 0), 0),
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Payroll');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ── Review (approve/reject/paid) ──────────────────────────────────────────
  async review(claimId: string, reviewerId: string, dto: ReviewClaimDto): Promise<ExpenseClaimEntity> {
    const claim = await this.claimRepo.findOneBy({ id: claimId });
    if (!claim) throw new NotFoundException('Klaim tidak ditemukan');

    if (dto.action === ReviewAction.APPROVE) {
      if (claim.status !== 'pending') throw new BadRequestException('Hanya klaim pending yang bisa di-approve');
      claim.status = 'approved';
    } else if (dto.action === ReviewAction.REJECT) {
      if (claim.status !== 'pending') throw new BadRequestException('Hanya klaim pending yang bisa ditolak');
      if (!dto.note) throw new BadRequestException('Alasan penolakan wajib diisi');
      claim.status = 'rejected';
    } else if (dto.action === ReviewAction.PAID) {
      if (claim.status !== 'approved') throw new BadRequestException('Hanya klaim approved yang bisa ditandai paid');
      claim.status = 'paid';
      claim.paid_at = new Date();
    }

    claim.reviewer_id = reviewerId;
    claim.review_note = dto.note ?? null;
    claim.reviewed_at = new Date();
    const saved = await this.claimRepo.save(claim);

    // Notifikasi ke pemohon + FYI ke manager/admin/super_admin
    try {
      const catLabel = CATEGORY_LABEL[saved.category] ?? saved.category;
      const claimNumber = saved.claim_number ?? '';
      const amountStr = `Rp ${Number(saved.amount).toLocaleString('id-ID')}`;
      const reviewerUser = await this.userRepo.findOne({ where: { id: reviewerId }, select: { id: true, full_name: true } });
      const reviewerName = reviewerUser?.full_name ?? 'Accounting';
      const requesterUser = await this.userRepo.findOne({ where: { id: saved.user_id }, select: { id: true, full_name: true } });
      const requesterName = requesterUser?.full_name ?? 'Karyawan';

      if (dto.action === ReviewAction.APPROVE) {
        await this.notifications.send({
          userId: saved.user_id,
          type: 'expense_claim_approved',
          title: 'Klaim Biaya Disetujui',
          body: `Klaim ${catLabel} ${claimNumber} (${amountStr}) telah disetujui.`,
          data: { expense_claim_id: saved.id, category: saved.category },
        });
        this.notifications.getFyiViewerIds([reviewerId, saved.user_id])
          .then((viewerIds) => {
            if (viewerIds.length === 0) return;
            return this.notifications.sendMany(
              viewerIds, 'expense_claim_fyi', 'Klaim Biaya Disetujui',
              `${reviewerName} menyetujui klaim ${catLabel} ${requesterName} (${amountStr}).`,
              { expense_claim_id: saved.id, category: saved.category },
            );
          }).catch(() => null);
      } else if (dto.action === ReviewAction.REJECT) {
        await this.notifications.send({
          userId: saved.user_id,
          type: 'expense_claim_rejected',
          title: 'Klaim Biaya Ditolak',
          body: dto.note
            ? `Klaim ${catLabel} ${claimNumber} ditolak. Alasan: ${dto.note}`
            : `Klaim ${catLabel} ${claimNumber} ditolak.`,
          data: { expense_claim_id: saved.id, category: saved.category },
        });
        this.notifications.getFyiViewerIds([reviewerId, saved.user_id])
          .then((viewerIds) => {
            if (viewerIds.length === 0) return;
            return this.notifications.sendMany(
              viewerIds, 'expense_claim_fyi', 'Klaim Biaya Ditolak',
              `${reviewerName} menolak klaim ${catLabel} ${requesterName} (${amountStr}).`,
              { expense_claim_id: saved.id, category: saved.category },
            );
          }).catch(() => null);
      } else if (dto.action === ReviewAction.PAID) {
        await this.notifications.send({
          userId: saved.user_id,
          type: 'expense_claim_paid',
          title: 'Klaim Biaya Dibayarkan',
          body: `Klaim ${catLabel} ${claimNumber} (${amountStr}) telah dibayarkan.`,
          data: { expense_claim_id: saved.id, category: saved.category },
        });
        this.notifications.getFyiViewerIds([reviewerId, saved.user_id])
          .then((viewerIds) => {
            if (viewerIds.length === 0) return;
            return this.notifications.sendMany(
              viewerIds, 'expense_claim_fyi', 'Klaim Biaya Dibayarkan',
              `${reviewerName} membayarkan klaim ${catLabel} ${requesterName} (${amountStr}).`,
              { expense_claim_id: saved.id, category: saved.category },
            );
          }).catch(() => null);
      }
    } catch (err) {
      this.logger.error(`[expense_claim_review] notif gagal: ${err}`);
    }

    return saved;
  }

  // ── Private: generate claim number ───────────────────────────────────────
  private async generateClaimNumber(claimId: string): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.ds.query<{ seq: number }[]>(
      `INSERT INTO claim_sequences (year, seq, updated_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (year) DO UPDATE
         SET seq = claim_sequences.seq + 1, updated_at = NOW()
       RETURNING seq`,
      [year],
    );
    const seq = result[0]?.seq ?? 1;
    const number = `KC-${year}/${String(seq).padStart(3, '0')}`;
    await this.claimRepo.update(claimId, { claim_number: number });
    return number;
  }
}
