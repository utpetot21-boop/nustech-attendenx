import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateAttendanceConfigDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  late_tolerance_minutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  alfa_threshold_hours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  objection_window_hours?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(5000)
  check_in_radius_meter?: number;

  @IsOptional()
  @IsNumber()
  office_lat?: number;

  @IsOptional()
  @IsNumber()
  office_lng?: number;
}
