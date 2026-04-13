import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TemplateSectionEntity } from './template-section.entity';

export type FieldType = 'text' | 'number' | 'checkbox' | 'radio' | 'select' | 'date' | 'textarea';

@Entity('template_fields')
export class TemplateFieldEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  section_id: string;

  @ManyToOne(() => TemplateSectionEntity, (s) => s.fields, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: TemplateSectionEntity;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'varchar', length: 30 })
  field_type: FieldType;

  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null;

  @Column({ type: 'boolean', default: false })
  is_required: boolean;

  @Column({ type: 'int', default: 0 })
  order_index: number;

  @CreateDateColumn()
  created_at: Date;
}
