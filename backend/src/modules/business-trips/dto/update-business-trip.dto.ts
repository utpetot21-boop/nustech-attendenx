import { PartialType } from '@nestjs/mapped-types';
import { IsNumber, IsOptional, IsPositive, IsString, IsUrl } from 'class-validator';
import { CreateBusinessTripDto } from './create-business-trip.dto';

export class UpdateBusinessTripDto extends PartialType(CreateBusinessTripDto) {
  @IsNumber()
  @IsPositive()
  @IsOptional()
  actual_cost?: number;

  @IsUrl()
  @IsOptional()
  doc_url?: string;
}
