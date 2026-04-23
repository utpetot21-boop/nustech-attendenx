import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, Not, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/redis.module';

import { RefreshTokenEntity } from '../users/entities/refresh-token.entity';
import { UserDeviceEntity } from '../users/entities/user-device.entity';
import { UserEntity } from '../users/entities/user.entity';
import type { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
const OTP_TTL_SECONDS = 10 * 60; // 10 menit
const RESET_TOKEN_TTL_SECONDS = 15 * 60; // 15 menit

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private refreshTokenRepo: Repository<RefreshTokenEntity>,
    @InjectRepository(UserDeviceEntity)
    private deviceRepo: Repository<UserDeviceEntity>,
    private jwtService: JwtService,
    private config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Login ─────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase().trim() },
      relations: ['role'],
      select: {
        id: true,
        employee_id: true,
        full_name: true,
        email: true,
        phone: true,
        password_hash: true,
        role_id: true,
        department_id: true,
        location_id: true,
        schedule_type: true,
        avatar_url: true,
        is_active: true,
        must_change_password: true,
        last_login_at: true,
      },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email atau password salah');
    }

    // Update last login
    await this.userRepo.update(user.id, { last_login_at: new Date() });

    // Upsert FCM device token jika ada
    if (dto.fcm_token && dto.platform) {
      // Nonaktifkan baris lama untuk token yang sama tapi user_id berbeda
      // (kasus: device dipakai bergantian oleh user lain → cegah salah kirim notif)
      await this.deviceRepo.update(
        { fcm_token: dto.fcm_token, user_id: Not(user.id), is_active: true },
        { is_active: false },
      );

      await this.deviceRepo.upsert(
        {
          user_id: user.id,
          fcm_token: dto.fcm_token,
          device_name: dto.device_name ?? null,
          platform: dto.platform,
          app_version: dto.app_version ?? null,
          is_active: true,
          last_active_at: new Date(),
        },
        ['user_id', 'fcm_token'],
      );
    }

    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      require_password_change: user.must_change_password,
      user: this.sanitizeUser(user),
    };
  }

  // ── Refresh Token ─────────────────────────────────────────────
  async refresh(userId: string, tokenId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId, is_active: true },
      relations: ['role'],
    });

    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    // Revoke token lama
    await this.refreshTokenRepo.update(tokenId, { revoked_at: new Date() });

    return this.generateTokens(user);
  }

  // ── Register / update FCM device token ───────────────────────
  async registerDevice(
    userId: string,
    fcm_token: string,
    platform: string,
  ): Promise<void> {
    const validPlatform = (['android', 'ios', 'web'] as const).includes(
      platform as 'android' | 'ios' | 'web',
    )
      ? (platform as 'android' | 'ios' | 'web')
      : 'android';

    // Nonaktifkan baris lama untuk token yang sama tapi user_id berbeda
    await this.deviceRepo.update(
      { fcm_token, user_id: Not(userId), is_active: true },
      { is_active: false },
    );

    await this.deviceRepo.upsert(
      {
        user_id: userId,
        fcm_token,
        platform: validPlatform,
        is_active: true,
        last_active_at: new Date(),
      },
      ['user_id', 'fcm_token'],
    );
  }

  // ── Logout ────────────────────────────────────────────────────
  async logout(userId: string, fcm_token?: string): Promise<void> {
    // Revoke semua refresh token aktif
    await this.refreshTokenRepo.update(
      { user_id: userId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );

    // Nonaktifkan device FCM jika ada
    if (fcm_token) {
      await this.deviceRepo.update(
        { user_id: userId, fcm_token },
        { is_active: false },
      );
    }
  }

  // ── Change Password ───────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!PASSWORD_REGEX.test(newPassword)) {
      throw new BadRequestException(
        'Password harus minimal 8 karakter, mengandung 1 huruf besar dan 1 angka',
      );
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, password_hash: true },
    });

    if (!user) throw new UnauthorizedException('User tidak ditemukan');

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new ForbiddenException('Password lama tidak sesuai');
    }

    // Pastikan tidak sama dengan password lama
    const isSame = await bcrypt.compare(newPassword, user.password_hash);
    if (isSame) {
      throw new BadRequestException('Password baru tidak boleh sama dengan password lama');
    }

    const newHash = await bcrypt.hash(newPassword, this.config.get<number>('app.bcryptRounds')!);

    await this.userRepo.update(userId, {
      password_hash: newHash,
      must_change_password: false,
    });

    // Revoke semua refresh token (force re-login di semua device)
    await this.refreshTokenRepo.update(
      { user_id: userId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );

    // Invalidate cached user profile
    this.redis.del(`user:${userId}`).catch(() => {});
  }

  // ── Set PIN (absensi) ─────────────────────────────────────────
  async setPin(userId: string, pin: string): Promise<void> {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      throw new BadRequestException('PIN harus 6 digit angka');
    }

    const pinHash = await bcrypt.hash(pin, this.config.get<number>('app.bcryptRounds')!);
    await this.userRepo.update(userId, { pin_hash: pinHash });
    this.redis.del(`user:${userId}`).catch(() => {});
  }

  // ── Has PIN set? (untuk UI: tampilkan "Set PIN" vs "Ganti PIN")
  async hasPinSet(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, pin_hash: true },
    });
    return !!user?.pin_hash;
  }

  // ── Verify PIN (dipanggil saat check-in fallback) ─────────────
  async verifyPin(userId: string, pin: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, pin_hash: true },
    });

    if (!user?.pin_hash) return false;

    return bcrypt.compare(pin, user.pin_hash);
  }

  // ── Forgot Password — Kirim OTP ──────────────────────────────
  async forgotPassword(identifier: string): Promise<{ message: string }> {
    const normalised = identifier.toLowerCase().trim();

    const user = await this.userRepo.findOne({
      where: [
        { email: normalised },
        { phone: normalised },
      ],
    });

    // Selalu kembalikan pesan sukses untuk cegah user enumeration
    const successMsg = 'Kode OTP telah dikirim ke email/nomor HP Anda';

    if (!user || !user.is_active) {
      this.logger.warn(`forgotPassword: user tidak ditemukan untuk identifier ${normalised}`);
      return { message: successMsg };
    }

    // Generate OTP 6 digit
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `otp:${user.id}`;

    // Simpan OTP ke Redis dengan TTL 10 menit
    await this.redis.setex(otpKey, OTP_TTL_SECONDS, otp);

    // Kirim via email (dan WA jika ada)
    const message = `Kode OTP reset password Anda: *${otp}*. Berlaku 10 menit. Jangan bagikan ke siapapun.`;

    try {
      if (user.email) {
        // Email via Resend — html sederhana
        const html = `<p>Kode OTP reset password Anda: <strong>${otp}</strong></p>
                      <p>Berlaku 10 menit. Jangan bagikan ke siapapun.</p>`;
        // Inline import untuk menghindari circular dep
        const { Resend } = await import('resend');
        const resend = new Resend(this.config.get<string>('RESEND_API_KEY') ?? '');
        await resend.emails.send({
          from: this.config.get<string>('RESEND_FROM_EMAIL') ?? 'noreply@nustech.id',
          to: user.email,
          subject: 'Kode OTP Reset Password AttendenX',
          html,
        }).catch(e => this.logger.warn(`Resend error: ${e.message}`));
      }
      if (user.phone) {
        this.logger.log(`OTP for ${user.phone}: ${otp} (WA delivery)`);
      }
    } catch (e) {
      this.logger.error(`forgotPassword send error: ${(e as Error).message}`);
    }

    return { message: successMsg };
  }

  // ── Verify OTP ────────────────────────────────────────────────
  async verifyOtp(identifier: string, otp: string): Promise<{ reset_token: string }> {
    const normalised = identifier.toLowerCase().trim();

    const user = await this.userRepo.findOne({
      where: [{ email: normalised }, { phone: normalised }],
    });

    if (!user || !user.is_active) {
      throw new BadRequestException('Kode OTP tidak valid atau sudah kadaluarsa');
    }

    const otpKey = `otp:${user.id}`;
    const stored = await this.redis.get(otpKey);

    if (!stored || stored !== otp.trim()) {
      throw new BadRequestException('Kode OTP tidak valid atau sudah kadaluarsa');
    }

    // Hapus OTP setelah verifikasi berhasil (single-use)
    await this.redis.del(otpKey);

    // Generate reset_token — UUID yang disimpan di Redis 15 menit
    const resetToken = uuidv4();
    await this.redis.setex(`reset:${resetToken}`, RESET_TOKEN_TTL_SECONDS, user.id);

    return { reset_token: resetToken };
  }

  // ── Reset Password ────────────────────────────────────────────
  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    if (!PASSWORD_REGEX.test(newPassword)) {
      throw new BadRequestException(
        'Password harus minimal 8 karakter, mengandung 1 huruf besar dan 1 angka',
      );
    }

    const tokenKey = `reset:${resetToken}`;
    const userId = await this.redis.get(tokenKey);

    if (!userId) {
      throw new BadRequestException('Token reset password tidak valid atau sudah kadaluarsa');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    const newHash = await bcrypt.hash(newPassword, this.config.get<number>('app.bcryptRounds') ?? 10);

    await this.userRepo.update(userId, {
      password_hash: newHash,
      must_change_password: false,
    });

    // Revoke semua refresh token aktif + hapus reset token
    await Promise.all([
      this.refreshTokenRepo.update(
        { user_id: userId, revoked_at: IsNull() },
        { revoked_at: new Date() },
      ),
      this.redis.del(tokenKey),
      this.redis.del(`user:${userId}`),
    ]);
  }

  // ── Admin Reset PIN karyawan ──────────────────────────────────
  async adminResetPin(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    await this.userRepo.update(userId, { pin_hash: null as any });
    this.redis.del(`user:${userId}`).catch(() => {});
  }

  // ── Internal: Generate tokens ─────────────────────────────────
  private async generateTokens(user: UserEntity) {
    const tokenId = uuidv4();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('app.jwtSecret'),
        expiresIn: this.config.get<string>('app.jwtAccessExpires') || '15m',
      }),
      this.jwtService.signAsync(
        { sub: user.id, jti: tokenId },
        {
          secret: this.config.get<string>('app.jwtRefreshSecret'),
          expiresIn: this.config.get<string>('app.jwtRefreshExpires') || '7d',
        },
      ),
    ]);

    // Simpan refresh token ke DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        id: tokenId,
        user_id: user.id,
        token: refresh_token,
        expires_at: expiresAt,
      }),
    );

    return { access_token, refresh_token };
  }

  private sanitizeUser(user: UserEntity) {
    const { password_hash: _, pin_hash: __, ...safe } = user as UserEntity & {
      password_hash?: string;
      pin_hash?: string;
    };
    return safe;
  }
}
