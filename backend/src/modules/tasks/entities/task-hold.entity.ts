import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';
import { TaskEntity } from './task.entity';
import { VisitEntity } from '../../visits/entities/visit.entity';

@Entity('task_holds')
export class TaskHoldEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  task_id: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: TaskEntity;

  @Column({ type: 'uuid', nullable: true })
  visit_id: string | null;

  @ManyToOne(() => VisitEntity, { nullable: true })
  @JoinColumn({ name: 'visit_id' })
  visit: VisitEntity | null;

  @Column({ type: 'uuid' })
  held_by: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'held_by' })
  holder: UserEntity;

  @Column({ type: 'varchar', length: 30 })
  reason_type: string;
  // client_absent | access_denied | equipment_broken | material_unavailable
  // client_cancel | weather | technician_sick | other

  @Column({ type: 'text' })
  reason_notes: string;

  @Column({ type: 'jsonb' })
  evidence_urls: string[];

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  held_at: Date;

  // ── Manajer review ──────────────────────────────────────────────────────────
  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: UserEntity | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected'],
  })
  review_status: string;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  reject_reason: string | null;

  // ── Reschedule ──────────────────────────────────────────────────────────────
  @Column({ type: 'date', nullable: true })
  reschedule_date: string | null;

  @Column({ type: 'text', nullable: true })
  reschedule_note: string | null;

  // ── Auto-approve ────────────────────────────────────────────────────────────
  @Column({ type: 'timestamptz', nullable: true })
  auto_approve_at: Date | null;

  @Column({ type: 'boolean', default: false })
  is_auto_approved: boolean;

  @CreateDateColumn()
  created_at: Date;
}
