import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TemplateSectionEntity } from './template-section.entity';
import { TemplatePhotoRequirementEntity } from './template-photo-requirement.entity';

@Entity('work_type_templates')
export class WorkTypeTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  work_type: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => TemplateSectionEntity, (s) => s.template, { cascade: true })
  sections: TemplateSectionEntity[];

  @OneToMany(() => TemplatePhotoRequirementEntity, (p) => p.template, { cascade: true })
  photo_requirements: TemplatePhotoRequirementEntity[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
