import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class AddPhotoDto {
  @IsEnum(['before', 'during', 'after'])
  phase: 'before' | 'during' | 'after';

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsString()
  @IsOptional()
  caption?: string;

  @IsUUID()
  @IsOptional()
  requirement_id?: string;
}
