import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';
import { AttendanceEntity } from './attendance.entity';

@Entity('attendance_violations')
export class AttendanceViolationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid' })
  attendance_id: string;

  @ManyToOne(() => AttendanceEntity)
  @JoinColumn({ name: 'attendance_id' })
  attendance: AttendanceEntity;

  @Column({ type: 'varchar', length: 30, default: 'alfa_no_balance' })
  type: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  balance_at_time: number;

  @Column({ type: 'boolean', default: false })
  is_resolved: boolean;

  @Column({ type: 'uuid', nullable: true })
  resolved_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolver: UserEntity | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date | null;

  @Column({ type: 'text', nullable: true })
  resolution_notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}
