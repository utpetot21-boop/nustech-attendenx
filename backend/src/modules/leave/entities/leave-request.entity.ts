import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { LeaveStatus, LeaveType } from '@nustech/shared';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('leave_requests')
export class LeaveRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 20, enum: ['cuti', 'izin', 'sakit', 'dinas'] })
  type: LeaveType;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  @Column({ type: 'integer', nullable: true })
  total_days: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', nullable: true })
  attachment_url: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected'],
  })
  status: LeaveStatus;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: UserEntity | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'text', nullable: true })
  reject_reason: string | null;

  @CreateDateColumn()
  created_at: Date;
}
