import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CorrectAttendanceDto {
  @IsISO8601()
  @IsOptional()
  check_in_at?: string;

  @IsISO8601()
  @IsOptional()
  check_out_at?: string;

  @IsEnum(['hadir', 'terlambat', 'alfa', 'izin', 'sakit', 'dinas'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  correction_reason: string;
}
