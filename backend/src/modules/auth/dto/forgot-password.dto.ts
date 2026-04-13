import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email atau nomor HP', example: 'admin@nustech.id' })
  @IsString()
  identifier: string; // email ATAU phone
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'admin@nustech.id' })
  @IsString()
  identifier: string;

  @ApiProperty({ example: '123456', description: 'OTP 6 digit' })
  @IsString()
  otp: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  reset_token: string;

  @ApiProperty({ description: 'Min 8 karakter, 1 huruf besar, 1 angka' })
  @IsString()
  new_password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  current_password: string;

  @ApiProperty({ description: 'Min 8 karakter, 1 huruf besar, 1 angka' })
  @IsString()
  new_password: string;
}

export class VerifyPinDto {
  @ApiProperty({ example: '123456', description: 'PIN 6 digit absensi' })
  @IsString()
  pin: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  user_id: string;
}

export class SetPinDto {
  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  pin: string;
}
