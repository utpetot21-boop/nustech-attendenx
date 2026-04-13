import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export type CheckInMethod = 'face_id' | 'fingerprint' | 'pin' | 'qr';

export class CheckInDto {
  @IsEnum(['face_id', 'fingerprint', 'pin', 'qr'])
  method: CheckInMethod;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsUUID()
  @IsOptional()
  device_id?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
