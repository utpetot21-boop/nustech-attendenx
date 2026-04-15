import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';
import { ShiftTypeEntity } from '../../schedule/entities/shift-type.entity';

export type SwapType   = 'with_person' | 'with_own_dayoff';
export type SwapStatus = 'pending_target' | 'pending_admin' | 'approved' | 'rejected' | 'cancelled';

@Entity('schedule_swap_requests')
export class ScheduleSwapRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Karyawan yang meminta tukar */
  @Column({ type: 'uuid' })
  requester_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_id' })
  requester: UserEntity;

  /** Karyawan target (null jika with_own_dayoff) */
  @Column({ type: 'uuid', nullable: true })
  target_user_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_user_id' })
  target_user: UserEntity | null;

  @Column({ type: 'varchar', length: 20 })
  type: SwapType;

  /** Tanggal jadwal requester yang ingin ditukar */
  @Column({ type: 'date' })
  requester_date: string;

  /** Tanggal jadwal target (atau hari libur requester sendiri) */
  @Column({ type: 'date' })
  target_date: string;

  @Column({ type: 'uuid', nullable: true })
  requester_shift_id: string | null;

  @ManyToOne(() => ShiftTypeEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requester_shift_id' })
  requester_shift: ShiftTypeEntity | null;

  @Column({ type: 'uuid', nullable: true })
  target_shift_id: string | null;

  @ManyToOne(() => ShiftTypeEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_shift_id' })
  target_shift: ShiftTypeEntity | null;

  @Column({ type: 'varchar', length: 20, default: 'pending_target' })
  status: SwapStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  reject_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver: UserEntity | null;

  @Column({ type: 'timestamptz', nullable: true })
  target_responded_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  admin_responded_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
