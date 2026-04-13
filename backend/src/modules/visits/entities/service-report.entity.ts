import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ClientEntity } from '../../clients/entities/client.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { VisitEntity } from './visit.entity';

@Entity('service_reports')
export class ServiceReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  visit_id: string;

  @OneToOne(() => VisitEntity, (visit) => visit.service_report, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visit_id' })
  visit: VisitEntity;

  @Column({ type: 'varchar', length: 30, unique: true, nullable: true })
  report_number: string | null; // BA-2025/04/001

  @Column({ type: 'uuid' })
  technician_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'technician_id' })
  technician: UserEntity;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => ClientEntity)
  @JoinColumn({ name: 'client_id' })
  client: ClientEntity;

  @Column({ type: 'varchar', nullable: true })
  client_pic_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  tech_signature_url: string | null;

  @Column({ type: 'varchar', nullable: true })
  client_signature_url: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    enum: ['digital', 'photo_upload'],
  })
  client_signature_type: 'digital' | 'photo_upload' | null;

  @Column({ type: 'timestamptz', nullable: true })
  signed_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  pdf_url: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  pdf_generated_at: Date | null;

  @Column({ type: 'boolean', default: false })
  is_locked: boolean;

  @Column({ type: 'boolean', default: false })
  sent_to_client: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
