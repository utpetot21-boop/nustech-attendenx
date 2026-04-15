import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// refresh_token opsional — web pakai HTTP-only cookie, mobile bisa kirim di body
export class RefreshTokenDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  refresh_token?: string;
}
