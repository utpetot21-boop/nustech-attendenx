import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  body: string;

  @IsEnum(['info', 'urgent', 'holiday', 'policy'])
  @IsOptional()
  type?: 'info' | 'urgent' | 'holiday' | 'policy';

  @IsEnum(['all', 'department', 'individual'])
  @IsOptional()
  target_type?: 'all' | 'department' | 'individual';

  @IsUUID()
  @IsOptional()
  target_dept_id?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  target_user_ids?: string[];

  @IsBoolean()
  @IsOptional()
  is_pinned?: boolean;

  @IsString()
  @IsOptional()
  pinned_until?: string;

  @IsBoolean()
  @IsOptional()
  send_push?: boolean;

  @IsBoolean()
  @IsOptional()
  send_whatsapp?: boolean;

  @IsString()
  @IsOptional()
  attachment_url?: string;

  @IsDateString()
  @IsOptional()
  expires_at?: string;
}
