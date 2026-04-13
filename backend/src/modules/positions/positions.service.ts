import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PositionEntity } from './entities/position.entity';
import { UserEntity } from '../users/entities/user.entity';
import type { CreatePositionDto } from './dto/create-position.dto';

@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(PositionEntity)
    private readonly positionRepo: Repository<PositionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  findAll(): Promise<PositionEntity[]> {
    return this.positionRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<PositionEntity> {
    const pos = await this.positionRepo.findOne({ where: { id } });
    if (!pos) throw new NotFoundException(`Jabatan ${id} tidak ditemukan`);
    return pos;
  }

  async create(dto: CreatePositionDto): Promise<PositionEntity> {
    const existing = await this.positionRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Jabatan "${dto.name}" sudah ada`);
    return this.positionRepo.save(this.positionRepo.create(dto));
  }

  async update(id: string, dto: Partial<CreatePositionDto>): Promise<PositionEntity> {
    const pos = await this.findOne(id);
    if (dto.name && dto.name !== pos.name) {
      const existing = await this.positionRepo.findOne({ where: { name: dto.name } });
      if (existing) throw new ConflictException(`Jabatan "${dto.name}" sudah ada`);
    }
    Object.assign(pos, dto);
    return this.positionRepo.save(pos);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const userCount = await this.userRepo.count({ where: { position_id: id } });
    if (userCount > 0) {
      throw new ConflictException(
        `Tidak dapat menghapus jabatan yang masih digunakan oleh ${userCount} karyawan`,
      );
    }
    await this.positionRepo.delete(id);
  }
}
