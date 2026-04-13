import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export type CheckOutMethod = 'manual' | 'qr';

export class CheckOutDto {
  @IsEnum(['manual', 'qr'])
  method: CheckOutMethod;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  lng?: number;
}
