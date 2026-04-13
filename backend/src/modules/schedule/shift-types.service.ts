import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { calculateShiftDuration, BUSINESS_CONSTANTS } from '@nustech/shared';
import { ShiftTypeEntity } from './entities/shift-type.entity';
import type { CreateShiftTypeDto } from './dto/create-shift-type.dto';

@Injectable()
export class ShiftTypesService {
  constructor(
    @InjectRepository(ShiftTypeEntity)
    private shiftRepo: Repository<ShiftTypeEntity>,
  ) {}

  findAll(departmentId?: string) {
    return this.shiftRepo.find({
      where: departmentId
        ? { is_active: true, department_id: departmentId }
        : { is_active: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException(`Shift type ${id} tidak ditemukan`);
    return shift;
  }

  async create(dto: CreateShiftTypeDto, createdBy: string) {
    this.validateDuration(dto.start_time, dto.end_time);

    const duration = calculateShiftDuration(dto.start_time, dto.end_time);

    return this.shiftRepo.save(
      this.shiftRepo.create({
        ...dto,
        duration_minutes: duration,
        created_by: createdBy,
      }),
    );
  }

  async update(id: string, dto: Partial<CreateShiftTypeDto>) {
    await this.findOne(id);

    // Jika ada perubahan jam, validasi ulang
    const current = await this.findOne(id);
    const start = dto.start_time ?? current.start_time;
    const end = dto.end_time ?? current.end_time;

    if (dto.start_time || dto.end_time) {
      this.validateDuration(start, end);
    }

    const duration = calculateShiftDuration(start, end);
    await this.shiftRepo.update(id, { ...dto, duration_minutes: duration });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.shiftRepo.update(id, { is_active: false });
  }

  // ── Validasi 8 jam WAJIB ──────────────────────────────────────
  private validateDuration(startTime: string, endTime: string) {
    const minutes = calculateShiftDuration(startTime, endTime);
    if (minutes !== BUSINESS_CONSTANTS.SHIFT_DURATION_MINUTES) {
      throw new BadRequestException(
        `Durasi shift harus tepat 8 jam (480 menit). ` +
        `Durasi "${startTime}–${endTime}" = ${minutes} menit. ` +
        `Silakan sesuaikan jam mulai atau jam selesai.`,
      );
    }
  }
}
