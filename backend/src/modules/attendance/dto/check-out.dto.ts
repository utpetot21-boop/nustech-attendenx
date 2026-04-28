import { IsEnum, IsNumber, Max, Min } from 'class-validator';

export type CheckOutMethod = 'manual' | 'qr';

export class CheckOutDto {
  @IsEnum(['manual', 'qr'])
  method: CheckOutMethod;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}
