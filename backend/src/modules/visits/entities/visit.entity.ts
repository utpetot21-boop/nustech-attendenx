import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClientEntity } from '../../clients/entities/client.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { VisitPhotoEntity } from './visit-photo.entity';
import { ServiceReportEntity } from './service-report.entity';

@Entity('visits')
export class VisitEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  task_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  template_id: string | null;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => ClientEntity)
  @JoinColumn({ name: 'client_id' })
  client: ClientEntity;

  @Column({ type: 'timestamptz', nullable: true })
  check_in_at: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  check_in_lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  check_in_lng: number | null;

  @Column({ type: 'varchar', nullable: true })
  check_in_address: string | null;

  @Column({ type: 'varchar', nullable: true })
  check_in_district: string | null;

  @Column({ type: 'varchar', nullable: true })
  check_in_province: string | null;

  @Column({ type: 'boolean', default: false })
  gps_valid: boolean;

  @Column({ type: 'integer', nullable: true })
  gps_deviation_meter: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  check_out_at: Date | null;

  @Column({ type: 'text', nullable: true })
  work_description: string | null;

  @Column({ type: 'text', nullable: true })
  findings: string | null;

  @Column({ type: 'text', nullable: true })
  recommendations: string | null;

  @Column({ type: 'jsonb', nullable: true })
  materials_used: Record<string, unknown>[] | null;

  @Column({ type: 'varchar', length: 20, default: 'ongoing' })
  status: string;

  @Column({ type: 'text', nullable: true })
  route_polyline: string | null;

  @Column({ type: 'integer', nullable: true })
  duration_minutes: number | null;

  @OneToMany(() => VisitPhotoEntity, (photo) => photo.visit)
  photos: VisitPhotoEntity[];

  @OneToOne(() => ServiceReportEntity, (report) => report.visit)
  service_report: ServiceReportEntity;

  // ── Review / Evaluasi (diisi admin/manager setelah kunjungan selesai) ─────────
  @Column({ type: 'varchar', length: 20, nullable: true })
  review_status: string | null; // 'approved' | 'revision_needed'

  @Column({ type: 'integer', nullable: true })
  review_rating: number | null; // 1-5

  @Column({ type: 'text', nullable: true })
  review_notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: UserEntity | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
