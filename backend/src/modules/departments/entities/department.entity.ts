import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { ScheduleType } from '@nustech/shared';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('departments')
export class DepartmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10, unique: true, nullable: true })
  code: string | null;

  @Column({ type: 'uuid', nullable: true })
  manager_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager: UserEntity | null;

  @Column({ type: 'varchar', length: 20, nullable: true, enum: ['shift', 'office_hours'] })
  schedule_type: ScheduleType | null;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => UserEntity, (user) => user.department)
  users: UserEntity[];
}
