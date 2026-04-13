import type { DataSource } from 'typeorm';

import { CompanyLeaveConfigEntity } from '../../modules/leave/entities/company-leave-config.entity';

export async function seedLeaveConfig(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(CompanyLeaveConfigEntity);
  const count = await repo.count();

  if (count > 0) {
    console.log('ℹ️  Leave config sudah ada, skip');
    return;
  }

  await repo.save(
    repo.create({
      max_leave_days_per_year: 12,
      monthly_accrual_amount: 1.0,
      holiday_work_credit: 1.0,
      alfa_deduction_amount: 1.0,
      objection_window_hours: 24,
      expiry_reminder_days: [30, 7],
      effective_date: new Date().toISOString().split('T')[0],
    }),
  );

  console.log('✅ Company leave config seeded');
}
