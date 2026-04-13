import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: string; // visit | maintenance | inspection | other

  @IsEnum(['low', 'normal', 'high', 'urgent'])
  priority: string;

  @IsUUID()
  @IsOptional()
  client_id?: string;

  @IsUUID()
  @IsOptional()
  location_id?: string;

  @IsEnum(['direct', 'broadcast'])
  dispatch_type: 'direct' | 'broadcast';

  @IsUUID()
  @IsOptional()
  assigned_to?: string; // required when dispatch_type = 'direct'

  @IsUUID()
  @IsOptional()
  broadcast_dept_id?: string; // required when dispatch_type = 'broadcast'

  @IsDateString()
  @IsOptional()
  scheduled_at?: string;

  @IsBoolean()
  @IsOptional()
  is_emergency?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
