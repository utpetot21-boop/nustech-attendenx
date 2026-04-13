import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';

@Entity('leave_balances')
@Unique(['user_id', 'year'])
export class LeaveBalanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'integer' })
  year: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  balance_days: number;

  @Column({ type: 'integer', default: 0 })
  accrued_monthly: number;

  @Column({ type: 'integer', default: 0 })
  accrued_holiday: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  used_days: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  expired_days: number;

  @Column({ type: 'integer', nullable: true })
  last_accrual_month: number | null;

  @Column({ type: 'date', nullable: true })
  last_accrual_date: string | null;

  @UpdateDateColumn()
  updated_at: Date;
}
