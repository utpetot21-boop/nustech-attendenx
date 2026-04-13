import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSelfDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  full_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
