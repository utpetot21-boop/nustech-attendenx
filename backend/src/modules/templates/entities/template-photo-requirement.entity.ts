import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkTypeTemplateEntity } from './work-type-template.entity';

@Entity('template_photo_requirements')
export class TemplatePhotoRequirementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  template_id: string;

  @ManyToOne(() => WorkTypeTemplateEntity, (t) => t.photo_requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: WorkTypeTemplateEntity;

  @Column({ type: 'varchar', length: 30 })
  phase: string; // 'before' | 'during' | 'after'

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'boolean', default: true })
  is_required: boolean;

  @Column({ type: 'int', default: 3 })
  max_photos: number;

  @Column({ type: 'int', default: 0 })
  order_index: number;
}
