import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReviewVisitDto {
  @IsIn(['approved', 'revision_needed'])
  review_status: string;

  @IsInt()
  @Min(1)
  @Max(5)
  review_rating: number;

  @IsOptional()
  @IsString()
  review_notes?: string;
}
