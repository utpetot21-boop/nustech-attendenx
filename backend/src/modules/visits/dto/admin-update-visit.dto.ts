import { IsArray, IsOptional, IsString } from 'class-validator';

export class AdminUpdateVisitDto {
  @IsString()
  @IsOptional()
  work_description?: string;

  @IsString()
  @IsOptional()
  findings?: string;

  @IsString()
  @IsOptional()
  recommendations?: string;

  @IsArray()
  @IsOptional()
  materials_used?: { name: string; qty: string }[];
}
