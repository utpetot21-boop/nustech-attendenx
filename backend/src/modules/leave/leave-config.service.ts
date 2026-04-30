import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CompanyLeaveConfigEntity } from './entities/company-leave-config.entity';
import { UpdateLeaveConfigDto } from './dto/update-leave-config.dto';
import { witaToday } from '../../common/utils/date.util';

@Injectable()
export class LeaveConfigService {
  constructor(
    @InjectRepository(CompanyLeaveConfigEntity)
    private repo: Repository<CompanyLeaveConfigEntity>,
  ) {}

  /**
   * Ambil konfigurasi terbaru (satu baris aktif)
   */
  async getConfig(): Promise<CompanyLeaveConfigEntity> {
    const configs = await this.repo.find({ order: { effective_date: 'DESC' }, take: 1 });
    const config = configs[0] ?? null;
    if (!config) throw new NotFoundException('Konfigurasi cuti belum diatur');
    return config;
  }

  /**
   * Update konfigurasi (admin only)
   * Buat entri baru dengan effective_date = hari ini agar history tersimpan
   */
  async updateConfig(
    dto: UpdateLeaveConfigDto,
    adminId: string,
  ): Promise<CompanyLeaveConfigEntity> {
    const current = await this.getConfig();

    const newConfig = this.repo.create({
      max_leave_days_per_year:
        dto.max_leave_days_per_year ?? current.max_leave_days_per_year,
      monthly_accrual_amount:
        dto.monthly_accrual_amount ?? current.monthly_accrual_amount,
      holiday_work_credit:
        dto.holiday_work_credit ?? current.holiday_work_credit,
      alfa_deduction_amount:
        dto.alfa_deduction_amount ?? current.alfa_deduction_amount,
      objection_window_hours:
        dto.objection_window_hours ?? current.objection_window_hours,
      expiry_reminder_days:
        dto.expiry_reminder_days ?? current.expiry_reminder_days,
      effective_date: witaToday(),
      updated_by: adminId,
    });

    return this.repo.save(newConfig);
  }
}
