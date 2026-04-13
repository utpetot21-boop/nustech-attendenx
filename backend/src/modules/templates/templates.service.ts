import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WorkTypeTemplateEntity } from './entities/work-type-template.entity';
import { TemplateSectionEntity } from './entities/template-section.entity';
import { TemplateFieldEntity } from './entities/template-field.entity';
import { TemplatePhotoRequirementEntity } from './entities/template-photo-requirement.entity';
import { VisitFormResponseEntity } from './entities/visit-form-response.entity';
import { CreateTemplateDto, FormResponseItemDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(WorkTypeTemplateEntity)
    private templateRepo: Repository<WorkTypeTemplateEntity>,
    @InjectRepository(TemplateSectionEntity)
    private sectionRepo: Repository<TemplateSectionEntity>,
    @InjectRepository(TemplateFieldEntity)
    private fieldRepo: Repository<TemplateFieldEntity>,
    @InjectRepository(TemplatePhotoRequirementEntity)
    private photoReqRepo: Repository<TemplatePhotoRequirementEntity>,
    @InjectRepository(VisitFormResponseEntity)
    private responseRepo: Repository<VisitFormResponseEntity>,
  ) {}

  // ── List / Detail ────────────────────────────────────────────────────────

  async findAll(includeInactive = false): Promise<WorkTypeTemplateEntity[]> {
    const qb = this.templateRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sections', 's')
      .leftJoinAndSelect('s.fields', 'f')
      .leftJoinAndSelect('t.photo_requirements', 'pr')
      .orderBy('t.name', 'ASC')
      .addOrderBy('s.order_index', 'ASC')
      .addOrderBy('f.order_index', 'ASC')
      .addOrderBy('pr.order_index', 'ASC');

    if (!includeInactive) {
      qb.where('t.is_active = true');
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<WorkTypeTemplateEntity> {
    const t = await this.templateRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sections', 's')
      .leftJoinAndSelect('s.fields', 'f')
      .leftJoinAndSelect('t.photo_requirements', 'pr')
      .where('t.id = :id', { id })
      .orderBy('s.order_index', 'ASC')
      .addOrderBy('f.order_index', 'ASC')
      .addOrderBy('pr.order_index', 'ASC')
      .getOne();

    if (!t) throw new NotFoundException('Template tidak ditemukan.');
    return t;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateTemplateDto): Promise<WorkTypeTemplateEntity> {
    const template = this.templateRepo.create({
      name: dto.name,
      work_type: dto.work_type,
      description: dto.description ?? null,
    });

    const saved = await this.templateRepo.save(template);

    // Sections + Fields
    for (const sDto of dto.sections) {
      const section = await this.sectionRepo.save(
        this.sectionRepo.create({
          template_id: saved.id,
          title: sDto.title,
          order_index: sDto.order_index ?? 0,
        }),
      );

      for (const fDto of sDto.fields) {
        await this.fieldRepo.save(
          this.fieldRepo.create({
            section_id: section.id,
            label: fDto.label,
            field_type: fDto.field_type as any,
            options: fDto.options ?? null,
            is_required: fDto.is_required ?? false,
            order_index: fDto.order_index ?? 0,
          }),
        );
      }
    }

    // Photo requirements
    for (const pDto of dto.photo_requirements) {
      await this.photoReqRepo.save(
        this.photoReqRepo.create({
          template_id: saved.id,
          phase: pDto.phase,
          label: pDto.label,
          is_required: pDto.is_required ?? true,
          max_photos: pDto.max_photos ?? 3,
          order_index: pDto.order_index ?? 0,
        }),
      );
    }

    return this.findOne(saved.id);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: Partial<CreateTemplateDto>): Promise<WorkTypeTemplateEntity> {
    const template = await this.findOne(id);

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.work_type !== undefined) template.work_type = dto.work_type;
    if (dto.description !== undefined) template.description = dto.description ?? null;

    await this.templateRepo.save(template);

    // If sections provided, replace all
    if (dto.sections !== undefined) {
      await this.sectionRepo.delete({ template_id: id });

      for (const sDto of dto.sections) {
        const section = await this.sectionRepo.save(
          this.sectionRepo.create({
            template_id: id,
            title: sDto.title,
            order_index: sDto.order_index ?? 0,
          }),
        );

        for (const fDto of sDto.fields) {
          await this.fieldRepo.save(
            this.fieldRepo.create({
              section_id: section.id,
              label: fDto.label,
              field_type: fDto.field_type as any,
              options: fDto.options ?? null,
              is_required: fDto.is_required ?? false,
              order_index: fDto.order_index ?? 0,
            }),
          );
        }
      }
    }

    // If photo_requirements provided, replace all
    if (dto.photo_requirements !== undefined) {
      await this.photoReqRepo.delete({ template_id: id });

      for (const pDto of dto.photo_requirements) {
        await this.photoReqRepo.save(
          this.photoReqRepo.create({
            template_id: id,
            phase: pDto.phase,
            label: pDto.label,
            is_required: pDto.is_required ?? true,
            max_photos: pDto.max_photos ?? 3,
            order_index: pDto.order_index ?? 0,
          }),
        );
      }
    }

    return this.findOne(id);
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  async toggleActive(id: string): Promise<WorkTypeTemplateEntity> {
    const template = await this.findOne(id);
    template.is_active = !template.is_active;
    return this.templateRepo.save(template);
  }

  // ── Visit form responses ──────────────────────────────────────────────────

  async saveFormResponses(visitId: string, responses: FormResponseItemDto[]): Promise<void> {
    for (const r of responses) {
      await this.responseRepo.upsert(
        {
          visit_id: visitId,
          field_id: r.field_id,
          value: r.value ?? null,
        },
        { conflictPaths: ['visit_id', 'field_id'] },
      );
    }
  }

  async getFormResponses(visitId: string): Promise<VisitFormResponseEntity[]> {
    return this.responseRepo.find({
      where: { visit_id: visitId },
      relations: ['field'],
      order: { created_at: 'ASC' },
    });
  }
}
