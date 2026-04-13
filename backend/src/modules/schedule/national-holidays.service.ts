import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NationalHolidayEntity } from './entities/national-holiday.entity';
import { CreateNationalHolidayDto } from './dto/create-national-holiday.dto';

@Injectable()
export class NationalHolidaysService {
  constructor(
    @InjectRepository(NationalHolidayEntity)
    private repo: Repository<NationalHolidayEntity>,
  ) {}

  async findByYear(year: number): Promise<NationalHolidayEntity[]> {
    return this.repo
      .createQueryBuilder('h')
      .where('EXTRACT(YEAR FROM h.date::date) = :year', { year })
      .orderBy('h.date', 'ASC')
      .getMany();
  }

  async create(dto: CreateNationalHolidayDto): Promise<NationalHolidayEntity> {
    return this.repo.save(
      this.repo.create({
        ...dto,
        is_active: dto.is_active ?? true,
      }),
    );
  }

  async update(
    id: string,
    dto: Partial<CreateNationalHolidayDto>,
  ): Promise<NationalHolidayEntity> {
    const holiday = await this.repo.findOne({ where: { id } });
    if (!holiday) throw new NotFoundException('Hari libur tidak ditemukan');
    await this.repo.update(id, dto);
    return this.repo.findOne({ where: { id } }) as Promise<NationalHolidayEntity>;
  }

  async remove(id: string): Promise<void> {
    const holiday = await this.repo.findOne({ where: { id } });
    if (!holiday) throw new NotFoundException('Hari libur tidak ditemukan');
    await this.repo.delete(id);
  }

  async isHoliday(dateStr: string): Promise<boolean> {
    const count = await this.repo.count({
      where: { date: dateStr, is_active: true },
    });
    return count > 0;
  }
}
