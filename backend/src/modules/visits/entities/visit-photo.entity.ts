import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { VisitEntity } from './visit.entity';
import { TemplatePhotoRequirementEntity } from '../../templates/entities/template-photo-requirement.entity';

@Entity('visit_photos')
export class VisitPhotoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  visit_id: string;

  @ManyToOne(() => VisitEntity, (visit) => visit.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visit_id' })
  visit: VisitEntity;

  @Column({ type: 'varchar', length: 10 })
  phase: 'before' | 'during' | 'after' | 'extra';

  @Column({ type: 'integer', nullable: true })
  seq_number: number | null;

  @Column({ type: 'varchar' })
  original_url: string;

  @Column({ type: 'varchar', nullable: true })
  thumbnail_url: string | null;

  @Column({ type: 'varchar' })
  watermarked_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  caption: string | null;

  @Column({ type: 'timestamptz' })
  taken_at: Date;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  lng: number | null;

  @Column({ type: 'varchar', nullable: true })
  district: string | null;

  @Column({ type: 'varchar', nullable: true })
  province: string | null;

  @Column({ type: 'integer', nullable: true })
  file_size_kb: number | null;

  @Column({ type: 'uuid', nullable: true })
  photo_requirement_id: string | null;

  @ManyToOne(() => TemplatePhotoRequirementEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'photo_requirement_id' })
  photo_requirement: TemplatePhotoRequirementEntity | null;

  // 'camera' = diambil langsung; 'gallery' = dari galeri HP (watermark berbeda); 'admin' = diupload admin web
  @Column({ type: 'varchar', length: 10, default: 'camera' })
  source: 'camera' | 'gallery' | 'admin';

  @Column({ type: 'text', nullable: true })
  admin_feedback: string | null;

  @Column({ default: false })
  needs_retake: boolean;

  @Column({ type: 'uuid', nullable: true })
  feedback_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  feedback_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
