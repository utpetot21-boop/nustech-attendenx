import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { AttendanceStatus, CheckinMethod, CheckoutMethod, ScheduleType } from '@nustech/shared';
import { LocationEntity } from '../../locations/entities/location.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { UserScheduleEntity } from '../../schedule/entities/user-schedule.entity';

@Entity('attendances')
export class AttendanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', nullable: true })
  user_schedule_id: string | null;

  @ManyToOne(() => UserScheduleEntity, { nullable: true })
  @JoinColumn({ name: 'user_schedule_id' })
  user_schedule: UserScheduleEntity | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  schedule_type: ScheduleType | null;

  @Column({ type: 'time', nullable: true })
  shift_start: string | null;

  @Column({ type: 'time', nullable: true })
  shift_end: string | null;

  @Column({ type: 'integer', default: 60 })
  tolerance_minutes: number;

  @Column({ type: 'timestamptz', nullable: true })
  check_in_at: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  check_in_method: CheckinMethod | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  check_in_lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  check_in_lng: number | null;

  @Column({ type: 'uuid', nullable: true })
  check_in_location_id: string | null;

  @ManyToOne(() => LocationEntity, { nullable: true })
  @JoinColumn({ name: 'check_in_location_id' })
  check_in_location: LocationEntity | null;

  @Column({ type: 'timestamptz', nullable: true })
  check_out_at: Date | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  check_out_method: CheckoutMethod | null;

  // checkout_earliest = check_in_at + 8 jam
  // Tidak pakai generated column karena check_in_at nullable saat row dibuat
  @Column({ type: 'timestamptz', nullable: true })
  checkout_earliest: Date | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'alfa',
    enum: ['hadir', 'terlambat', 'alfa', 'izin', 'sakit', 'dinas'],
  })
  status: AttendanceStatus;

  @Column({ type: 'integer', default: 0 })
  late_minutes: number;

  @Column({ type: 'integer', default: 0 })
  overtime_minutes: number;

  @Column({ type: 'boolean', nullable: true })
  gps_valid: boolean | null;

  @Column({ type: 'boolean', default: false })
  is_holiday_work: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** true jika check-in terlambat tapi ada izin terlambat yang diapprove */
  @Column({ type: 'boolean', default: false })
  late_approved: boolean;

  /** true jika checkout lebih awal tapi ada izin pulang awal yang diapprove */
  @Column({ type: 'boolean', default: false })
  early_departure_approved: boolean;

  @CreateDateColumn()
  created_at: Date;
}
