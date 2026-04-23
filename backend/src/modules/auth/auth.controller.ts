import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { UserEntity } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { ChangePasswordDto, SetPinDto, VerifyPinDto, ForgotPasswordDto, VerifyOtpDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Cookie helpers ────────────────────────────────────────────────────────────
function setAccessCookie(res: Response, token: string) {
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 menit
    path: '/',
  });
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    path: '/',
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ── POST /auth/login ──────────────────────────────────────────
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Login karyawan (email + password)' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    setAccessCookie(res, result.access_token);
    setRefreshCookie(res, result.refresh_token);
    // Kembalikan token di body juga agar mobile & WebSocket bisa pakai
    return result;
  }

  // ── POST /auth/refresh ────────────────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Body() _dto: RefreshTokenDto,
    @CurrentUser() payload: { userId: string; tokenId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refresh(payload.userId, payload.tokenId);
    setAccessCookie(res, result.access_token);
    setRefreshCookie(res, result.refresh_token);
    return result;
  }

  // ── GET /auth/me ──────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: UserEntity) {
    return {
      id: user.id,
      employee_id: user.employee_id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar_url,
      role: user.role,
      role_id: user.role_id,
      department_id: user.department_id,
      is_active: user.is_active,
    };
  }

  // ── POST /auth/logout ─────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout & revoke refresh token' })
  async logout(
    @CurrentUser() user: UserEntity,
    @Body('fcm_token') fcmToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.id, fcmToken);
    clearAuthCookies(res);
  }

  // ── POST /auth/change-password ────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ganti password (termasuk first login)' })
  async changePassword(
    @CurrentUser() user: UserEntity,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto.current_password, dto.new_password);
  }

  // ── POST /auth/set-pin ────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('set-pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Set PIN 6 digit untuk absensi (fallback biometrik)' })
  async setPin(
    @CurrentUser() user: UserEntity,
    @Body() dto: SetPinDto,
  ): Promise<void> {
    await this.authService.setPin(user.id, dto.pin);
  }

  // ── POST /auth/verify-pin ─────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('verify-pin')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verifikasi PIN absensi (dipanggil dari mobile saat check-in fallback biometrik)' })
  async verifyPin(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyPinDto,
  ): Promise<{ valid: boolean }> {
    const valid = await this.authService.verifyPin(userId, dto.pin);
    if (!valid) {
      throw new UnauthorizedException('PIN salah');
    }
    return { valid: true };
  }

  // ── POST /auth/fcm-token ──────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('fcm-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Register/update FCM push token perangkat saat ini' })
  async registerFcmToken(
    @CurrentUser() user: UserEntity,
    @Body() body: { fcm_token: string; platform: string },
  ): Promise<void> {
    if (!body.fcm_token || !body.platform) return;
    await this.authService.registerDevice(user.id, body.fcm_token, body.platform);
  }

  // ── POST /auth/forgot-password ────────────────────────────────
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Minta OTP reset password via email/WA' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.identifier);
  }

  // ── POST /auth/verify-otp ─────────────────────────────────────
  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Verifikasi OTP, dapatkan reset_token' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.identifier, dto.otp);
  }

  // ── POST /auth/reset-password ─────────────────────────────────
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password dengan reset_token dari verify-otp' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.reset_token, dto.new_password);
  }
}
