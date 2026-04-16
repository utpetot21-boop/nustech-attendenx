import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { AttendanceRequestType } from '../entities/attendance-request.entity';

export class CreateAttendanceRequestDto {
  @IsEnum(['late_arrival', 'early_departure'])
  type: AttendanceRequestType;

  @IsString()
  @IsNotEmpty()
  reason: string;

  /** Format HH:mm — perkiraan jam tiba atau jam pulang */
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'estimated_time harus format HH:mm' })
  estimated_time?: string;
}
