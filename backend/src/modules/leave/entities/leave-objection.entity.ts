import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';
import { PendingDeductionEntity } from './pending-deduction.entity';

@Entity('leave_objections')
export class LeaveObjectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pending_deduction_id: string;

  @ManyToOne(() => PendingDeductionEntity)
  @JoinColumn({ name: 'pending_deduction_id' })
  pending_deduction: PendingDeductionEntity;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', nullable: true })
  evidence_url: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected'],
  })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: UserEntity | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  reject_reason: string | null;

  @CreateDateColumn()
  created_at: Date;
}
