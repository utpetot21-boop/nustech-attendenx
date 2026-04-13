import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export enum ClaimCategory {
  TRANSPORT   = 'transport',
  PARKIR      = 'parkir',
  MATERIAL    = 'material',
  KONSUMSI    = 'konsumsi',
  AKOMODASI   = 'akomodasi',
  LAINNYA     = 'lainnya',
}

export class CreateClaimDto {
  @IsEnum(ClaimCategory)
  category: ClaimCategory;

  @IsInt()
  @Min(1)
  @Max(10_000_000)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  /** Array of R2 URLs — sudah diupload sebelumnya */
  @IsOptional()
  receipt_urls?: string[];

  @IsOptional()
  @IsUUID()
  visit_id?: string;
}
