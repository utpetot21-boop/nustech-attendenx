import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWarningLetterDto {
  @ApiProperty({ description: 'UUID karyawan yang diberi SP' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ enum: ['SP1', 'SP2', 'SP3'] })
  @IsEnum(['SP1', 'SP2', 'SP3'])
  level: 'SP1' | 'SP2' | 'SP3';

  @ApiProperty({ description: 'Alasan pemberian SP' })
  @IsString()
  reason: string;

  @ApiProperty({ required: false, description: 'UUID attendance_violation terkait' })
  @IsUUID()
  @IsOptional()
  reference_violation_id?: string;

  @ApiProperty({ required: false, example: '2026-06-01' })
  @IsDateString()
  @IsOptional()
  issued_at?: string;

  @ApiProperty({ required: false, example: '2026-09-01' })
  @IsDateString()
  @IsOptional()
  valid_until?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
