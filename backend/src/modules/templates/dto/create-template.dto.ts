import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateTemplateFieldDto {
  @IsString() @IsNotEmpty()
  label: string;

  @IsIn(['text', 'number', 'checkbox', 'radio', 'select', 'date', 'textarea'])
  field_type: string;

  @IsArray() @IsOptional() @IsString({ each: true })
  options?: string[];

  @IsBoolean() @IsOptional()
  is_required?: boolean;

  @IsInt() @Min(0) @IsOptional()
  order_index?: number;
}

export class CreateTemplateSectionDto {
  @IsString() @IsNotEmpty()
  title: string;

  @IsInt() @Min(0) @IsOptional()
  order_index?: number;

  @IsArray() @ValidateNested({ each: true })
  @Type(() => CreateTemplateFieldDto)
  fields: CreateTemplateFieldDto[];
}

export class CreatePhotoRequirementDto {
  @IsIn(['before', 'during', 'after'])
  phase: string;

  @IsString() @IsNotEmpty()
  label: string;

  @IsBoolean() @IsOptional()
  is_required?: boolean;

  @IsInt() @Min(1) @IsOptional()
  max_photos?: number;

  @IsInt() @Min(0) @IsOptional()
  order_index?: number;
}

export class CreateTemplateDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString() @IsNotEmpty()
  work_type: string;

  @IsString() @IsOptional()
  description?: string;

  @IsArray() @ValidateNested({ each: true })
  @Type(() => CreateTemplateSectionDto)
  sections: CreateTemplateSectionDto[];

  @IsArray() @ValidateNested({ each: true })
  @Type(() => CreatePhotoRequirementDto)
  photo_requirements: CreatePhotoRequirementDto[];
}

export class SaveFormResponsesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormResponseItemDto)
  responses: FormResponseItemDto[];
}

export class FormResponseItemDto {
  @IsString() @IsNotEmpty()
  field_id: string;

  @IsString() @IsOptional()
  value?: string;
}
