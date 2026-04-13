import { IsOptional, IsString } from 'class-validator';

export class RejectTripDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
