import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import Redis from 'ioredis';

import { UserEntity } from '../../users/entities/user.entity';
import { REDIS_CLIENT } from '../../cache/redis.module';

export interface JwtPayload {
  sub: string;       // user id
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

const USER_CACHE_TTL = 300; // 5 menit

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private config: ConfigService,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super({
      // Cookie dulu (web), fallback ke Bearer header (mobile / Swagger)
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => req?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwtSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<UserEntity> {
    const cacheKey = `user:${payload.sub}`;

    // Cache hit — skip DB
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const user = JSON.parse(cached) as UserEntity;
        if (!user.is_active) throw new UnauthorizedException('Akun tidak aktif');
        if (user.role) return user; // skip cache jika role null — reload dari DB
      }
    } catch (_err) {
      // Redis mati → fallback ke DB
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub, is_active: true },
      relations: ['role'],
    });

    if (!user) {
      throw new UnauthorizedException('Akun tidak ditemukan atau tidak aktif');
    }

    // Cache write — fire and forget
    this.redis.setex(cacheKey, USER_CACHE_TTL, JSON.stringify(user)).catch(() => {});

    return user;
  }
}
