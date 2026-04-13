import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { VisitEntity } from './visit.entity';

@Entity('visit_photos')
export class VisitPhotoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  visit_id: string;

  @ManyToOne(() => VisitEntity, (visit) => visit.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visit_id' })
  visit: VisitEntity;

  @Column({ type: 'varchar', length: 10, enum: ['before', 'during', 'after'] })
  phase: 'before' | 'during' | 'after';

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

  @CreateDateColumn()
  created_at: Date;
}
