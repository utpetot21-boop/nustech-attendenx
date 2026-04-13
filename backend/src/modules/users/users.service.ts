import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import Redis from 'ioredis';

import { UserEntity } from './entities/user.entity';
import { DepartmentEntity } from '../departments/entities/department.entity';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import { REDIS_CLIENT } from '../cache/redis.module';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(DepartmentEntity)
    private deptRepo: Repository<DepartmentEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private invalidateUserCache(id: string): void {
    this.redis.del(`user:${id}`).catch(() => {});
  }

  /**
   * Generate employee_id berikutnya dalam format NT-001, NT-002, dst.
   * Cari nomor tertinggi yang sudah ada, lalu +1.
   */
  async generateNextEmployeeId(): Promise<string> {
    const PREFIX = 'NT-';
    // Ambil semua employee_id yang berawalan NT-
    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select('u.employee_id', 'eid')
      .where('u.employee_id LIKE :pattern', { pattern: `${PREFIX}%` })
      .getRawMany<{ eid: string }>();

    let max = 0;
    for (const { eid } of rows) {
      const num = parseInt(eid.replace(PREFIX, ''), 10);
      if (!isNaN(num) && num > max) max = num;
    }

    const next = String(max + 1).padStart(3, '0');
    return `${PREFIX}${next}`;
  }

  async findAll(filters?: {
    dept?: string;
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: FindOptionsWhere<UserEntity> = {};
    if (filters?.dept) where.department_id = filters.dept;
    if (filters?.role) where.role_id = filters.role;
    if (filters?.search) {
      return this.userRepo.findAndCount({
        where: [
          { full_name: ILike(`%${filters.search}%`), ...where },
          { employee_id: ILike(`%${filters.search}%`), ...where },
          { email: ILike(`%${filters.search}%`), ...where },
        ],
        relations: ['role', 'department', 'location', 'position'],
        order: { created_at: 'DESC' },
        take: filters?.limit ?? 20,
        skip: ((filters?.page ?? 1) - 1) * (filters?.limit ?? 20),
      });
    }

    return this.userRepo.findAndCount({
      where,
      relations: ['role', 'department', 'location', 'position'],
      order: { created_at: 'DESC' },
      take: filters?.limit ?? 20,
      skip: ((filters?.page ?? 1) - 1) * (filters?.limit ?? 20),
    });
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['role', 'department', 'location', 'position'],
    });
    if (!user) throw new NotFoundException(`User dengan id ${id} tidak ditemukan`);
    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { email: email.toLowerCase() },
      relations: ['role'],
    });
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    // Auto-generate employee_id jika tidak diisi
    const employee_id = dto.employee_id?.trim() || (await this.generateNextEmployeeId());

    // Cek duplikat email
    const existingEmail = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingEmail) {
      throw new ConflictException(`Email "${dto.email}" sudah digunakan oleh karyawan lain`);
    }

    // Cek duplikat employee_id (hanya jika manual)
    if (dto.employee_id?.trim()) {
      const existingEmpId = await this.userRepo.findOne({
        where: { employee_id },
      });
      if (existingEmpId) {
        throw new ConflictException(`ID Karyawan "${employee_id}" sudah digunakan — gunakan ID yang berbeda`);
      }
    }

    // Cek duplikat NIK (jika diisi)
    if (dto.nik) {
      const existingNik = await this.userRepo.findOne({ where: { nik: dto.nik } });
      if (existingNik) {
        throw new ConflictException(`NIK "${dto.nik}" sudah terdaftar atas nama ${existingNik.full_name}`);
      }
    }

    // Auto-apply schedule_type dari departemen jika user tidak menentukannya
    let effectiveScheduleType = dto.schedule_type;
    if (!effectiveScheduleType && dto.department_id) {
      const dept = await this.deptRepo.findOne({ where: { id: dto.department_id } });
      if (dept?.schedule_type) {
        effectiveScheduleType = dept.schedule_type;
      }
    }

    // Password: gunakan initial_password jika diisi, default ke employee_id
    const defaultPassword = dto.initial_password?.trim() || employee_id;
    const password_hash = await bcrypt.hash(defaultPassword, 12);

    const user = this.userRepo.create({
      ...dto,
      employee_id,
      schedule_type: effectiveScheduleType ?? 'office_hours',
      email: dto.email.toLowerCase().trim(),
      password_hash,
      must_change_password: true,
    });

    return this.userRepo.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findOne(id);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepo.findOne({
        where: { email: dto.email.toLowerCase() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email sudah digunakan');
      }
    }

    Object.assign(user, dto);
    const saved = await this.userRepo.save(user);
    this.invalidateUserCache(id);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    // Soft delete: set is_active = false
    await this.userRepo.update(id, { is_active: false });
    this.invalidateUserCache(id);
    void user; // suppress unused warning
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<void> {
    await this.userRepo.update(id, { avatar_url: avatarUrl });
    this.invalidateUserCache(id);
  }

  async resetPassword(id: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User tidak ditemukan');
    const hash = await bcrypt.hash(user.employee_id, 12);
    await this.userRepo.update(id, { password_hash: hash, must_change_password: true });
    this.invalidateUserCache(id);
  }
}
