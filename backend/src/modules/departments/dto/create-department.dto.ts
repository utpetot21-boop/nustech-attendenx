import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'IT & Engineering' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false, example: 'IT' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  manager_id?: string;

  @ApiProperty({ required: false, enum: ['shift', 'office_hours'] })
  @IsOptional()
  @IsIn(['shift', 'office_hours'])
  schedule_type?: 'shift' | 'office_hours';
}
