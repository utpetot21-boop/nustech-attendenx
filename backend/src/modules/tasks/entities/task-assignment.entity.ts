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

@Entity('task_assignments')
export class TaskAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  task_id: string;

  @ManyToOne(() => TaskEntity, (task) => task.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: TaskEntity;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['offered', 'accepted', 'rejected', 'auto_assigned'],
  })
  status: string;

  @Column({ type: 'timestamptz' })
  offered_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  responded_at: Date | null;

  @Column({ type: 'text', nullable: true })
  reject_reason: string | null;

  @Column({ type: 'boolean', default: false })
  is_current: boolean;

  @CreateDateColumn()
  created_at: Date;
}
