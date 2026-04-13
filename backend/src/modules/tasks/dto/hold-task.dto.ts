import { IsArray, IsEnum, IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

export class HoldTaskDto {
  @IsUUID()
  @IsOptional()
  visit_id?: string;

  @IsEnum([
    'client_absent',
    'access_denied',
    'equipment_broken',
    'material_unavailable',
    'client_cancel',
    'weather',
    'technician_sick',
    'other',
  ])
  reason_type: string;

  @IsString()
  @IsNotEmpty()
  reason_notes: string;

  @IsArray()
  @IsString({ each: true })
  evidence_urls: string[]; // 1–5 URLs uploaded via separate endpoint
}
