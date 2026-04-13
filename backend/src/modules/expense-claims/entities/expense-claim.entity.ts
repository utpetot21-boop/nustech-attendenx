import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('expense_claims')
export class ExpenseClaimEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'varchar', length: 30, unique: true, nullable: true })
  claim_number: string | null;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', nullable: true })
  visit_id: string | null;

  @Column({ type: 'varchar', length: 30 })
  category: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: [] })
  receipt_urls: string[];

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'approved' | 'rejected' | 'paid';

  @Column({ type: 'uuid', nullable: true })
  reviewer_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: UserEntity;

  @Column({ type: 'text', nullable: true })
  review_note: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
