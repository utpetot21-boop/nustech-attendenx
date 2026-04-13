import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessTripEntity } from './entities/business-trip.entity';
import { CreateBusinessTripDto } from './dto/create-business-trip.dto';
import { UpdateBusinessTripDto } from './dto/update-business-trip.dto';

@Injectable()
export class BusinessTripsService {
  constructor(
    @InjectRepository(BusinessTripEntity)
    private readonly tripRepo: Repository<BusinessTripEntity>,
  ) {}

  private async generateTripNumber(): Promise<string> {
    const now = new Date();
    const yymm = `${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.tripRepo.count();
    return `ST-${yymm}-${String(count + 1).padStart(4, '0')}`;
  }

  // ── LIST ──────────────────────────────────────────────────────────────────────
  async findAll(opts: {
    userId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;

    const qb = this.tripRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'u')
      .leftJoinAndSelect('t.approver', 'ap')
      .orderBy('t.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (opts.userId) qb.andWhere('t.user_id = :uid', { uid: opts.userId });
    if (opts.status) qb.andWhere('t.status = :status', { status: opts.status });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  // ── DETAIL ────────────────────────────────────────────────────────────────────
  async findOne(id: string): Promise<BusinessTripEntity> {
    const trip = await this.tripRepo.findOne({
      where: { id },
      relations: ['user', 'approver'],
    });
    if (!trip) throw new NotFoundException('Surat tugas tidak ditemukan.');
    return trip;
  }

  // ── CREATE ────────────────────────────────────────────────────────────────────
  async create(userId: string, dto: CreateBusinessTripDto): Promise<BusinessTripEntity> {
    const trip_number = await this.generateTripNumber();

    const trip = this.tripRepo.create({
      ...dto,
      trip_number,
      user_id: userId,
      status: 'draft',
    });

    return this.tripRepo.save(trip);
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────────
  async update(
    id: string,
    userId: string,
    role: string,
    dto: UpdateBusinessTripDto,
  ): Promise<BusinessTripEntity> {
    const trip = await this.findOne(id);

    const isAdmin = ['admin', 'manager'].includes(role);

    if (!isAdmin && trip.user_id !== userId) {
      throw new ForbiddenException('Tidak dapat mengubah surat tugas milik orang lain.');
    }

    if (!isAdmin && !['draft', 'rejected'].includes(trip.status)) {
      throw new BadRequestException('Surat tugas tidak dapat diubah pada status ini.');
    }

    Object.assign(trip, dto);
    return this.tripRepo.save(trip);
  }

  // ── SUBMIT (draft → pending_approval) ────────────────────────────────────────
  async submit(id: string, userId: string): Promise<BusinessTripEntity> {
    const trip = await this.findOne(id);

    if (trip.user_id !== userId) {
      throw new ForbiddenException('Hanya pembuat surat tugas yang dapat mengajukan.');
    }

    if (trip.status !== 'draft' && trip.status !== 'rejected') {
      throw new BadRequestException('Surat tugas hanya dapat diajukan dari status draft/rejected.');
    }

    await this.tripRepo.update(id, { status: 'pending_approval' });
    return this.findOne(id);
  }

  // ── APPROVE ───────────────────────────────────────────────────────────────────
  async approve(id: string, approverId: string): Promise<BusinessTripEntity> {
    const trip = await this.findOne(id);

    if (trip.status !== 'pending_approval') {
      throw new BadRequestException('Surat tugas tidak dalam status menunggu persetujuan.');
    }

    await this.tripRepo.update(id, {
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date(),
    });

    return this.findOne(id);
  }

  // ── REJECT ────────────────────────────────────────────────────────────────────
  async reject(id: string, approverId: string, reason?: string): Promise<BusinessTripEntity> {
    const trip = await this.findOne(id);

    if (trip.status !== 'pending_approval') {
      throw new BadRequestException('Surat tugas tidak dalam status menunggu persetujuan.');
    }

    await this.tripRepo.update(id, {
      status: 'rejected',
      approved_by: approverId,
      rejection_reason: reason ?? null,
    });

    return this.findOne(id);
  }

  // ── DEPART (approved → ongoing) ───────────────────────────────────────────────
  async depart(id: string, userId: string): Promise<BusinessTripEntity> {
    const trip = await this.findOne(id);

    if (trip.user_id !== userId) {
      throw new ForbiddenException('Hanya pemegang surat tugas yang dapat memulai perjalanan.');
    }

    if (trip.status !== 'approved') {
      throw new BadRequestException('Surat tugas belum disetujui.');
    }

    await this.tripRepo.update(id, {
      status: 'ongoing',
      departed_at: new Date(),
    });

    return this.findOne(id);
  }

  // ── RETURN (ongoing → completed) ─────────────────────────────────────────────
  async complete(
    id: string,
    userId: string,
    role: string,
    dto: { actual_cost?: number; doc_url?: string },
  ): Promise<BusinessTripEntity> {
    const trip = await this.findOne(id);

    const isAdmin = ['admin', 'manager'].includes(role);
    if (!isAdmin && trip.user_id !== userId) {
      throw new ForbiddenException('Tidak berwenang menyelesaikan surat tugas ini.');
    }

    if (trip.status !== 'ongoing') {
      throw new BadRequestException('Surat tugas tidak sedang berjalan.');
    }

    await this.tripRepo.update(id, {
      status: 'completed',
      returned_at: new Date(),
      ...(dto.actual_cost !== undefined && { actual_cost: dto.actual_cost }),
      ...(dto.doc_url && { doc_url: dto.doc_url }),
    });

    return this.findOne(id);
  }

  // ── CANCEL ────────────────────────────────────────────────────────────────────
  async cancel(id: string, userId: string, role: string): Promise<void> {
    const trip = await this.findOne(id);

    const isAdmin = ['admin', 'manager'].includes(role);
    if (!isAdmin && trip.user_id !== userId) {
      throw new ForbiddenException('Tidak berwenang membatalkan surat tugas ini.');
    }

    if (['completed', 'cancelled', 'ongoing'].includes(trip.status)) {
      throw new BadRequestException('Surat tugas tidak dapat dibatalkan pada status ini.');
    }

    await this.tripRepo.update(id, { status: 'cancelled' });
  }
}
