import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsEnum(['cuti', 'izin', 'sakit', 'dinas'])
  type: 'cuti' | 'izin' | 'sakit' | 'dinas';

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  attachment_url?: string;
}
