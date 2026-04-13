import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateObjectionDto {
  @IsUUID()
  pending_deduction_id: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  evidence_url?: string;
}
