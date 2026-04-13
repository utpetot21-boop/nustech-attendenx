import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { ScheduleType } from '@nustech/shared';
import { ShiftTypeEntity } from './shift-type.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('user_schedules')
export class UserScheduleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', nullable: true })
  shift_type_id: string | null;

  @ManyToOne(() => ShiftTypeEntity, { nullable: true })
  @JoinColumn({ name: 'shift_type_id' })
  shift_type: ShiftTypeEntity | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  schedule_type: ScheduleType | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  @Column({ type: 'integer', default: 60 })
  tolerance_minutes: number;

  @Column({ type: 'boolean', default: false })
  is_holiday: boolean;

  @Column({ type: 'boolean', default: false })
  is_day_off: boolean;

  @CreateDateColumn()
  created_at: Date;
}
