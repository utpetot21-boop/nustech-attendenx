import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

export type BusinessTripStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'ongoing'
  | 'completed'
  | 'cancelled';

@Entity('business_trips')
export class BusinessTripEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  trip_number: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: UserEntity | null;

  @Column({ type: 'varchar', length: 255 })
  destination: string;

  @Column({ type: 'text' })
  purpose: string;

  @Column({ type: 'date' })
  depart_date: string;

  @Column({ type: 'date' })
  return_date: string;

  @Column({
    type: 'enum',
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'ongoing', 'completed', 'cancelled'],
    default: 'draft',
  })
  status: BusinessTripStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  transport_mode: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  estimated_cost: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  actual_cost: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  advance_amount: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  doc_url: string | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  departed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  returned_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
