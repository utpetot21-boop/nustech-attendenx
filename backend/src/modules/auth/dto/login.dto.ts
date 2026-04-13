import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@nustech-attendenx.id' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @ApiProperty({ example: 'Admin@1234' })
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @ApiProperty({ required: false, example: 'Samsung Galaxy A54' })
  @IsOptional() @IsString()
  device_name?: string;

  @ApiProperty({ required: false, enum: ['android', 'ios', 'web'] })
  @IsOptional() @IsString()
  platform?: 'android' | 'ios' | 'web';

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  fcm_token?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  app_version?: string;
}
