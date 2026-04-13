import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';
import { TaskEntity } from './task.entity';

@Entity('delegations')
export class DelegationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  task_id: string;

  @ManyToOne(() => TaskEntity, (task) => task.delegations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: TaskEntity;

  @Column({ type: 'uuid' })
  from_user_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'from_user_id' })
  from_user: UserEntity;

  @Column({ type: 'uuid' })
  to_user_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'to_user_id' })
  to_user: UserEntity;

  @Column({ type: 'varchar', length: 10, nullable: true, enum: ['delegate', 'swap'] })
  type: 'delegate' | 'swap' | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    enum: ['pending', 'accepted', 'rejected', 'expired'],
  })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: UserEntity | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'text', nullable: true })
  reject_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  swap_task_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
