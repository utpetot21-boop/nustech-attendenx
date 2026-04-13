import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ required: false, example: 'NT-005', description: 'Kosongkan untuk auto-generate' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  employee_id?: string;

  @ApiProperty({ required: false, example: '3201234567890001', description: 'NIK KTP (16 digit)' })
  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(20)
  nik?: string;

  @ApiProperty({ example: 'Ahmad Syarif' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  full_name: string;

  @ApiProperty({ example: 'ahmad@nustech.id' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '08123456789' })
  @IsString()
  @Matches(/^(\+62|62|0)[0-9]{8,15}$/, { message: 'Format nomor HP tidak valid' })
  phone: string;

  @ApiProperty({ description: 'UUID role', example: '550e8400-...' })
  @IsUUID()
  role_id: string;

  @ApiProperty({ required: false, description: 'UUID jabatan/posisi pekerjaan' })
  @IsOptional()
  @IsUUID()
  position_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  department_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  location_id?: string;

  @ApiProperty({ required: false, enum: ['male', 'female'] })
  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: 'male' | 'female';

  @ApiProperty({ required: false, enum: ['shift', 'office_hours'] })
  @IsOptional()
  @IsIn(['shift', 'office_hours'])
  schedule_type?: 'shift' | 'office_hours';

  @ApiProperty({ required: false, description: 'UUID shift type default (hanya untuk schedule_type=shift)' })
  @IsOptional()
  @IsUUID()
  default_shift_type_id?: string;

  @ApiProperty({ required: false, description: 'Password awal custom. Jika kosong, default ke employee_id' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  initial_password?: string;
}
