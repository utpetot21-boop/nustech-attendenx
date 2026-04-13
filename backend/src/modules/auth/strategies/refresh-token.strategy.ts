import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IsNull, Repository } from 'typeorm';

import { RefreshTokenEntity } from '../../users/entities/refresh-token.entity';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private config: ConfigService,
    @InjectRepository(RefreshTokenEntity)
    private refreshTokenRepo: Repository<RefreshTokenEntity>,
  ) {
    super({
      // Cookie dulu (web), fallback ke body field (mobile / Postman)
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => req?.cookies?.refresh_token ?? null,
        ExtractJwt.fromBodyField('refresh_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwtRefreshSecret')!,
      passReqToCallback: false,
    });
  }

  async validate(payload: { sub: string; jti: string }) {
    const token = await this.refreshTokenRepo.findOne({
      where: {
        id: payload.jti,
        user_id: payload.sub,
        revoked_at: IsNull(),
      },
    });

    if (!token) {
      throw new UnauthorizedException('Refresh token tidak valid atau sudah dicabut');
    }

    if (token.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token sudah expired');
    }

    return { userId: payload.sub, tokenId: payload.jti };
  }
}
