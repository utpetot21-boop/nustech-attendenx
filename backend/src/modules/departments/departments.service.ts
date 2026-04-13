import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DepartmentEntity } from './entities/department.entity';
import type { CreateDepartmentDto } from './dto/create-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(DepartmentEntity)
    private deptRepo: Repository<DepartmentEntity>,
  ) {}

  findAll() {
    return this.deptRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const dept = await this.deptRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException(`Departemen ${id} tidak ditemukan`);
    return dept;
  }

  async create(dto: CreateDepartmentDto) {
    if (dto.code) {
      const existing = await this.deptRepo.findOne({ where: { code: dto.code } });
      if (existing) throw new ConflictException(`Kode ${dto.code} sudah digunakan`);
    }
    return this.deptRepo.save(this.deptRepo.create(dto));
  }

  async update(id: string, dto: Partial<CreateDepartmentDto>) {
    await this.findOne(id);
    await this.deptRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.deptRepo.delete(id);
  }
}
