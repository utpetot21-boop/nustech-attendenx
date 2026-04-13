import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ApproveHoldDto {
  @IsDateString()
  reschedule_date: string;

  @IsString()
  @IsOptional()
  reschedule_note?: string;

  // 'same' = teknisi sama, uuid = teknisi lain, undefined = broadcast ke dept
  @IsOptional()
  rescheduled_assign_to?: 'same' | string;
}

export class RejectHoldDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
