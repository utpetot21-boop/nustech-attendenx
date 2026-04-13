import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { calculateShiftDuration, BUSINESS_CONSTANTS } from '@nustech/shared';
import { OfficeHoursConfigEntity } from './entities/office-hours-config.entity';
import type { CreateOfficeHoursDto } from './dto/create-office-hours.dto';

@Injectable()
export class OfficeHoursService {
  constructor(
    @InjectRepository(OfficeHoursConfigEntity)
    private ohRepo: Repository<OfficeHoursConfigEntity>,
  ) {}

  findByUser(userId: string) {
    return this.ohRepo.find({
      where: { user_id: userId },
      order: { effective_date: 'DESC' },
    });
  }

  findByDepartment(departmentId: string) {
    return this.ohRepo.find({
      where: { department_id: departmentId },
      order: { effective_date: 'DESC' },
    });
  }

  /**
   * Ambil config aktif untuk user pada tanggal tertentu
   * (config terbaru dengan effective_date <= target date)
   */
  async getActiveConfig(userId: string, targetDate: string): Promise<OfficeHoursConfigEntity | null> {
    return this.ohRepo.findOne({
      where: {
        user_id: userId,
        effective_date: MoreThanOrEqual(targetDate) as unknown as string,
      },
      order: { effective_date: 'DESC' },
    });
  }

  async create(dto: CreateOfficeHoursDto, createdBy: string) {
    this.validateDuration(dto.start_time, dto.end_time);

    const duration = calculateShiftDuration(dto.start_time, dto.end_time);

    return this.ohRepo.save(
      this.ohRepo.create({
        ...dto,
        work_days: dto.work_days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        duration_minutes: duration,
        created_by: createdBy,
      }),
    );
  }

  /** Ambil konfigurasi global (user_id IS NULL, department_id IS NULL) */
  findGlobal(): Promise<OfficeHoursConfigEntity | null> {
    return this.ohRepo.findOne({
      where: { user_id: null as any, department_id: null as any },
      order: { effective_date: 'DESC' },
    });
  }

  /** Upsert global config — buat baru jika belum ada, update jika sudah */
  async upsertGlobal(dto: Partial<CreateOfficeHoursDto>, createdBy: string): Promise<OfficeHoursConfigEntity> {
    const existing = await this.findGlobal();

    if (existing) {
      const start = dto.start_time ?? existing.start_time;
      const end = dto.end_time ?? existing.end_time;
      if (dto.start_time || dto.end_time) this.validateDuration(start, end);
      const duration = calculateShiftDuration(start, end);
      await this.ohRepo.update(existing.id, { ...dto, duration_minutes: duration });
      return this.ohRepo.findOne({ where: { id: existing.id } }) as Promise<OfficeHoursConfigEntity>;
    }

    // Belum ada — buat baru
    const start = dto.start_time ?? '08:00';
    const end = dto.end_time ?? '16:00';
    this.validateDuration(start, end);
    const duration = calculateShiftDuration(start, end);
    return this.ohRepo.save(
      this.ohRepo.create({
        ...dto,
        start_time: start,
        end_time: end,
        work_days: dto.work_days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        effective_date: dto.effective_date ?? new Date().toISOString().split('T')[0],
        duration_minutes: duration,
        created_by: createdBy,
        user_id: null,
        department_id: null,
      }),
    );
  }

  async update(id: string, dto: Partial<CreateOfficeHoursDto>) {
    const existing = await this.ohRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Office hours config ${id} tidak ditemukan`);

    const start = dto.start_time ?? existing.start_time;
    const end = dto.end_time ?? existing.end_time;

    if (dto.start_time || dto.end_time) {
      this.validateDuration(start, end);
    }

    const duration = calculateShiftDuration(start, end);
    await this.ohRepo.update(id, { ...dto, duration_minutes: duration });
    return this.ohRepo.findOne({ where: { id } });
  }

  private validateDuration(startTime: string, endTime: string) {
    const minutes = calculateShiftDuration(startTime, endTime);
    if (minutes !== BUSINESS_CONSTANTS.SHIFT_DURATION_MINUTES) {
      throw new BadRequestException(
        `Durasi office hours harus tepat 8 jam (480 menit). ` +
        `"${startTime}–${endTime}" = ${minutes} menit.`,
      );
    }
  }
}
