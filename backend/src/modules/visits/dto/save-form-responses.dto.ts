import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class FormResponseItemDto {
  @IsUUID()
  field_id: string;

  @IsString() @IsOptional()
  value?: string;
}

export class SaveFormResponsesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormResponseItemDto)
  responses: FormResponseItemDto[];
}
