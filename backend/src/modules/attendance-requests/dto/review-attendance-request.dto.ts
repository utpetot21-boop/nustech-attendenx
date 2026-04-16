import { IsOptional, IsString } from 'class-validator';

export class ReviewAttendanceRequestDto {
  @IsOptional()
  @IsString()
  reviewer_note?: string;
}
