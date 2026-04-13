import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

export type ContractType = 'regular' | 'priority' | 'emergency';

@Entity('clients')
export class ClientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pic_name: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pic_phone: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  pic_email: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  lng: number | null;

  @Column({ type: 'integer', default: 200 })
  radius_meter: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  // ── SLA & Kontrak ──────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 20, default: 'regular' })
  contract_type: ContractType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contract_number: string | null;

  @Column({ type: 'date', nullable: true })
  contract_start: string | null;

  @Column({ type: 'date', nullable: true })
  contract_end: string | null;

  @Column({ type: 'integer', default: 24 })
  sla_response_hours: number;

  @Column({ type: 'integer', default: 48 })
  sla_completion_hours: number;

  @Column({ type: 'integer', default: 0 })
  monthly_visit_quota: number;

  @Column({ type: 'uuid', nullable: true })
  account_manager_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'account_manager_id' })
  account_manager: UserEntity | null;

  @Column({ type: 'text', nullable: true })
  contract_doc_url: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}
