import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { LeaveLogType } from '@nustech/shared';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('leave_balance_logs')
export class LeaveBalanceLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 30 })
  type: LeaveLogType;

  @Column({ type: 'decimal', precision: 5, scale: 1 })
  amount: number;

  @Column({ type: 'decimal', precision: 5, scale: 1 })
  balance_after: number;

  @Column({ type: 'uuid', nullable: true })
  reference_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}
