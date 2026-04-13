import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TemplateFieldEntity } from './template-field.entity';

@Entity('visit_form_responses')
@Unique(['visit_id', 'field_id'])
export class VisitFormResponseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  visit_id: string;

  @Column({ type: 'uuid' })
  field_id: string;

  @ManyToOne(() => TemplateFieldEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'field_id' })
  field: TemplateFieldEntity;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @CreateDateColumn()
  created_at: Date;
}
