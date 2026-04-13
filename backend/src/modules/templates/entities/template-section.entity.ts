import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkTypeTemplateEntity } from './work-type-template.entity';
import { TemplateFieldEntity } from './template-field.entity';

@Entity('template_sections')
export class TemplateSectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  template_id: string;

  @ManyToOne(() => WorkTypeTemplateEntity, (t) => t.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: WorkTypeTemplateEntity;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'int', default: 0 })
  order_index: number;

  @OneToMany(() => TemplateFieldEntity, (f) => f.section, { cascade: true })
  fields: TemplateFieldEntity[];

  @CreateDateColumn()
  created_at: Date;
}
