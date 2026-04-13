import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // ── Sentry error tracking ─────────────────────────────────────────────────
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
    Logger.log('Sentry initialized', 'Bootstrap');
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ── Security ─────────────────────────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // ── CORS ─────────────────────────────────────────────────────
  const isDev = process.env.NODE_ENV !== 'production';
  app.enableCors({
    origin: isDev
      ? // Development: izinkan localhost, IP lokal LAN, dan Expo Go
        (origin, callback) => {
          // Izinkan request tanpa origin (mobile app native, Postman, curl)
          if (!origin) return callback(null, true);
          // Izinkan localhost semua port
          if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
          // Izinkan semua IP lokal LAN (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
          if (/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) return callback(null, true);
          // Izinkan WEB_URL yang dikonfigurasi
          if (origin === (process.env.WEB_URL || 'http://localhost:3000')) return callback(null, true);
          callback(new Error(`CORS blocked: ${origin}`));
        }
      : // Production: hanya izinkan domain resmi
        [process.env.WEB_URL || 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Global prefix ─────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Global validation pipe ────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global exception filter ───────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Swagger ───────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Nustech-AttendenX API')
      .setDescription('API documentation untuk sistem absensi Nustech-AttendenX')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth', 'Autentikasi & token')
      .addTag('users', 'Manajemen karyawan')
      .addTag('attendance', 'Absensi check-in/out')
      .addTag('schedule', 'Jadwal & shift')
      .addTag('visits', 'Kunjungan lapangan')
      .addTag('tasks', 'Dispatch & tugas')
      .addTag('leave', 'Cuti & izin')
      .addTag('reports', 'Laporan & export')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  Logger.log(`🚀 AttendenX API running on: http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
