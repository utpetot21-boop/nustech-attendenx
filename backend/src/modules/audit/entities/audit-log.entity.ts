import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  action: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  entity_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  entity_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  old_data: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  new_data: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  ip_address: string | null;

  @CreateDateColumn()
  created_at: Date;
}
