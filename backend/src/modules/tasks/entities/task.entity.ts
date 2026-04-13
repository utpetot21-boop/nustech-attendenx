import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { TaskPriority } from '@nustech/shared';
import { ClientEntity } from '../../clients/entities/client.entity';
import { DepartmentEntity } from '../../departments/entities/department.entity';
import { LocationEntity } from '../../locations/entities/location.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { TaskAssignmentEntity } from './task-assignment.entity';
import { DelegationEntity } from './delegation.entity';

@Entity('tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  type: string | null; // visit|maintenance|inspection|other

  @Column({
    type: 'varchar',
    length: 10,
    default: 'normal',
    enum: ['low', 'normal', 'high', 'urgent'],
  })
  priority: TaskPriority;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'unassigned',
  })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  client_id: string | null;

  @ManyToOne(() => ClientEntity, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client: ClientEntity | null;

  @Column({ type: 'uuid', nullable: true })
  location_id: string | null;

  @ManyToOne(() => LocationEntity, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location: LocationEntity | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_to: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignee: UserEntity | null;

  @Column({ type: 'uuid' })
  created_by: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity;

  @Column({ type: 'varchar', length: 10, nullable: true, enum: ['direct', 'broadcast'] })
  dispatch_type: 'direct' | 'broadcast' | null;

  @Column({ type: 'uuid', nullable: true })
  broadcast_dept_id: string | null;

  @ManyToOne(() => DepartmentEntity, { nullable: true })
  @JoinColumn({ name: 'broadcast_dept_id' })
  broadcast_dept: DepartmentEntity | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirm_deadline: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'boolean', default: false })
  is_emergency: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  template_id: string | null;

  @OneToMany(() => TaskAssignmentEntity, (a) => a.task)
  assignments: TaskAssignmentEntity[];

  @OneToMany(() => DelegationEntity, (d) => d.task)
  delegations: DelegationEntity[];

  @CreateDateColumn()
  created_at: Date;
}
