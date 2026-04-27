import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class GivePhotoFeedbackDto {
  @IsString()
  @MaxLength(500)
  feedback: string;

  @IsBoolean()
  @IsOptional()
  needs_retake?: boolean;
}
