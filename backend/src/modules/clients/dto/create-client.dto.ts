import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  pic_name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  pic_phone?: string;

  @IsEmail()
  @IsOptional()
  pic_email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsNumber()
  @IsOptional()
  @Min(50)
  @Max(5000)
  radius_meter?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsEnum(['regular', 'priority', 'emergency'])
  @IsOptional()
  contract_type?: 'regular' | 'priority' | 'emergency';

  @IsString()
  @IsOptional()
  @MaxLength(100)
  contract_number?: string;

  @IsString()
  @IsOptional()
  contract_start?: string;

  @IsString()
  @IsOptional()
  contract_end?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  sla_response_hours?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  sla_completion_hours?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  monthly_visit_quota?: number;

  @IsUUID()
  @IsOptional()
  account_manager_id?: string;

  @IsString()
  @IsOptional()
  contract_doc_url?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
