import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'Kantor Pusat Makassar' })
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: -5.147665 })
  @IsNumber()
  @Min(-90) @Max(90)
  lat: number;

  @ApiProperty({ example: 119.432731 })
  @IsNumber()
  @Min(-180) @Max(180)
  lng: number;

  @ApiProperty({ example: 100, description: 'Radius geofence dalam meter' })
  @IsOptional()
  @IsNumber()
  @Min(10) @Max(5000)
  radius_meter?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
