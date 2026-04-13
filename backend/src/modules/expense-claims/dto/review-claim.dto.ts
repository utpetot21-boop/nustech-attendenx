import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReviewAction {
  APPROVE = 'approve',
  REJECT  = 'reject',
  PAID    = 'paid',
}

export class ReviewClaimDto {
  @IsEnum(ReviewAction)
  action: ReviewAction;

  @IsOptional()
  @IsString()
  note?: string;
}
