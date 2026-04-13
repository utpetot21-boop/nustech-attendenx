import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';
import { AttendanceViolationEntity } from '../../attendance/entities/attendance-violation.entity';

export type WarningLevel = 'SP1' | 'SP2' | 'SP3';

@Entity('warning_letters')
export class WarningLetterEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 5 })
  level: WarningLevel;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  reference_violation_id: string | null;

  @ManyToOne(() => AttendanceViolationEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reference_violation_id' })
  reference_violation: AttendanceViolationEntity | null;

  @Column({ type: 'uuid' })
  issued_by: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'issued_by' })
  issuer: UserEntity;

  @Column({ type: 'date' })
  issued_at: string;

  @Column({ type: 'date', nullable: true })
  valid_until: string | null;

  @Column({ type: 'uuid', nullable: true })
  acknowledged_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledger: UserEntity | null;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledged_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  doc_url: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}
