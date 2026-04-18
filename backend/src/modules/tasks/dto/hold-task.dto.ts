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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence_urls?: string[]; // 0–5 URLs (optional)
}
