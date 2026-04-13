import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || '',
  ttl: parseInt(process.env.REDIS_TTL || '86400', 10), // 1 hari default
  geocodingTtl: 60 * 60 * 24 * 30, // 30 hari untuk geocoding cache
}));
