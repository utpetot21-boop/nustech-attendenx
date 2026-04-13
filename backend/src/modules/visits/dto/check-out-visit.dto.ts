import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MaterialUsedDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  qty: string;
}

export class CheckOutVisitDto {
  @IsString()
  @IsNotEmpty()
  work_description: string;

  @IsString()
  @IsOptional()
  findings?: string;

  @IsString()
  @IsOptional()
  recommendations?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MaterialUsedDto)
  materials_used?: MaterialUsedDto[];
}
