import { IsNumber, IsOptional, IsInt, Min, Max } from 'class-validator';

export class ActivateSosDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  battery_pct?: number;
}
