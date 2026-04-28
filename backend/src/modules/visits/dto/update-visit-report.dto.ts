import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MaterialUsedDto {
  @IsString() name: string;
  @IsString() qty: string;
}

class FormResponseItemDto {
  @IsString() field_id: string;
  @IsString() value: string;
}

export class UpdateVisitReportDto {
  @IsString() @IsOptional() work_description?: string;
  @IsString() @IsOptional() findings?: string;
  @IsString() @IsOptional() recommendations?: string;

  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MaterialUsedDto)
  materials_used?: MaterialUsedDto[];

  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FormResponseItemDto)
  form_responses?: FormResponseItemDto[];
}
