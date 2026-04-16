import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

export type AttendanceRequestType   = 'late_arrival' | 'early_departure';
export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

@Entity('attendance_requests')
export class AttendanceRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 20 })
  type: AttendanceRequestType;

  @Column({ type: 'text' })
  reason: string;

  /** Perkiraan jam tiba (late_arrival) atau jam pulang (early_departure) */
  @Column({ type: 'time', nullable: true })
  estimated_time: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: AttendanceRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: UserEntity | null;

  @Column({ type: 'text', nullable: true })
  reviewer_note: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
