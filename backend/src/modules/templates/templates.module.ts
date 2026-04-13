import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkTypeTemplateEntity } from './entities/work-type-template.entity';
import { TemplateSectionEntity } from './entities/template-section.entity';
import { TemplateFieldEntity } from './entities/template-field.entity';
import { TemplatePhotoRequirementEntity } from './entities/template-photo-requirement.entity';
import { VisitFormResponseEntity } from './entities/visit-form-response.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkTypeTemplateEntity,
      TemplateSectionEntity,
      TemplateFieldEntity,
      TemplatePhotoRequirementEntity,
      VisitFormResponseEntity,
    ]),
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
