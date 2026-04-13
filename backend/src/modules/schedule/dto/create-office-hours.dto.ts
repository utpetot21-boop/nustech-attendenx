import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export class CreateOfficeHoursDto {
  @ApiProperty({ required: false, description: 'UUID karyawan (jika per-karyawan)' })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiProperty({ required: false, description: 'UUID departemen (jika per-dept)' })
  @IsOptional()
  @IsUUID()
  department_id?: string;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'start_time harus format HH:mm' })
  start_time: string;

  @ApiProperty({ example: '16:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'end_time harus format HH:mm' })
  end_time: string;

  @ApiProperty({
    example: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    description: 'Hari kerja',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(VALID_DAYS, { each: true })
  work_days?: string[];

  @ApiProperty({ required: false, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(0) @Max(120)
  tolerance_minutes?: number;

  @ApiProperty({ example: '2025-01-01', description: 'Berlaku mulai tanggal ini (tidak retroaktif)' })
  @IsDateString()
  effective_date: string;
}
