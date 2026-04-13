import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveLeaveDto {} // no body needed

export class RejectLeaveDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReviewObjectionDto {
  @IsString()
  @IsOptional()
  reject_reason?: string; // only for rejection
}
