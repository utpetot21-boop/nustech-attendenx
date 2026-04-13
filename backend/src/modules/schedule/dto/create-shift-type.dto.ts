import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateShiftTypeDto {
  @ApiProperty({ example: 'Shift Pagi' })
  @IsString()
  name: string;

  @ApiProperty({ example: '07:00', description: 'Format HH:mm' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'start_time harus format HH:mm' })
  start_time: string;

  @ApiProperty({ example: '15:00', description: 'Format HH:mm (boleh lintas tengah malam)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'end_time harus format HH:mm' })
  end_time: string;

  @ApiProperty({ required: false, default: 60, description: 'Toleransi keterlambatan (menit)' })
  @IsOptional()
  @IsInt()
  @Min(0) @Max(120)
  tolerance_minutes?: number;

  @ApiProperty({ required: false, default: '#007AFF' })
  @IsOptional()
  @IsHexColor()
  color_hex?: string;

  @ApiProperty({ required: false, description: 'UUID departemen (opsional)' })
  @IsOptional()
  @IsUUID()
  department_id?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
