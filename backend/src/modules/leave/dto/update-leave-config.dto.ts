import { IsArray, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateLeaveConfigDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(60)
  max_leave_days_per_year?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5)
  monthly_accrual_amount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5)
  holiday_work_credit?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5)
  alfa_deduction_amount?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(72)
  objection_window_hours?: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  expiry_reminder_days?: number[];
}
