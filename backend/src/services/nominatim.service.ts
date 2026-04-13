import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../modules/cache/redis.module';

export interface GeoAddress {
  address: string;
  district: string;
  province: string;
}

@Injectable()
export class NominatimService {
  private readonly logger = new Logger(NominatimService.name);
  private readonly ttl: number; // seconds (default 30 days)

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.ttl = config.get<number>('redis.geocodingTtl') ?? 60 * 60 * 24 * 30;
  }

  async reverse(lat: number, lng: number): Promise<GeoAddress> {
    const cacheKey = `geocode:${lat.toFixed(4)}:${lng.toFixed(4)}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as GeoAddress;
    }

    const result = await this.fetchFromNominatim(lat, lng);
    await this.redis.setex(cacheKey, this.ttl, JSON.stringify(result));
    return result;
  }

  private async fetchFromNominatim(lat: number, lng: number): Promise<GeoAddress> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'NustechAttendenX/1.0 (noreply@nustech.id)' },
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);

      const data = (await resp.json()) as {
        display_name?: string;
        address?: {
          county?: string;
          city?: string;
          city_district?: string;
          suburb?: string;
          state?: string;
          province?: string;
          road?: string;
        };
      };

      const addr = data.address ?? {};
      const district =
        addr.county ?? addr.city ?? addr.city_district ?? addr.suburb ?? '';
      const province = addr.state ?? addr.province ?? '';
      const address = data.display_name ?? `${lat}, ${lng}`;

      return { address, district, province };
    } catch (err) {
      this.logger.warn(`Nominatim reverse geocode failed for (${lat}, ${lng}): ${err}`);
      return {
        address: `${lat}, ${lng}`,
        district: '',
        province: '',
      };
    }
  }
}
