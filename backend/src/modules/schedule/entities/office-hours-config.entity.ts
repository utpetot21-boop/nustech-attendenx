import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DepartmentEntity } from '../../departments/entities/department.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('office_hours_config')
export class OfficeHoursConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity | null;

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  @ManyToOne(() => DepartmentEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department: DepartmentEntity | null;

  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  @Column({ type: 'integer' })
  duration_minutes: number;

  @Column({ type: 'jsonb', default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] })
  work_days: string[];

  @Column({ type: 'integer', default: 60 })
  tolerance_minutes: number;

  @Column({ type: 'date' })
  effective_date: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity | null;

  @CreateDateColumn()
  created_at: Date;
}
