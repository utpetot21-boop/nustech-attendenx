import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';

@Entity('company_leave_config')
export class CompanyLeaveConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', default: 12 })
  max_leave_days_per_year: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 1.0 })
  monthly_accrual_amount: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 1.0 })
  holiday_work_credit: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 1.0 })
  alfa_deduction_amount: number;

  @Column({ type: 'integer', default: 24 })
  objection_window_hours: number;

  @Column({ type: 'jsonb', default: [30, 7] })
  expiry_reminder_days: number[];

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  effective_date: string;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updater: UserEntity | null;

  @UpdateDateColumn()
  updated_at: Date;
}
