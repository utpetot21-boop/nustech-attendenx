import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AttendanceEntity } from '../../attendance/entities/attendance.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('pending_deductions')
export class PendingDeductionEntity {
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

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 1.0 })
  amount: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    enum: ['pending', 'executed', 'auto_executed', 'cancelled'],
  })
  status: string;

  @Column({ type: 'timestamptz' })
  deadline_at: Date; // 24 jam setelah alfa terdeteksi

  @Column({ type: 'timestamptz', nullable: true })
  executed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
