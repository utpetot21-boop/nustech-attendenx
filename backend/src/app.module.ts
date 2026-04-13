import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { PositionsModule } from './modules/positions/positions.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ScheduleModule as AppScheduleModule } from './modules/schedule/schedule.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ClientsModule } from './modules/clients/clients.module';
import { LeaveModule } from './modules/leave/leave.module';
import { VisitsModule } from './modules/visits/visits.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ServiceReportsModule } from './modules/service-reports/service-reports.module';
import { ExpenseClaimsModule } from './modules/expense-claims/expense-claims.module';
import { SosModule } from './modules/sos/sos.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { WarningLettersModule } from './modules/warning-letters/warning-letters.module';
import { BusinessTripsModule } from './modules/business-trips/business-trips.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { RedisModule } from './modules/cache/redis.module';

@Module({
  imports: [
    // ── Config ─────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig],
      envFilePath: ['.env', '.env.local'],
    }),

    // ── Database (TypeORM) ──────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get<number>('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false, // Gunakan migrations, JANGAN synchronize di production
        logging: config.get('app.nodeEnv') === 'development',
        ssl: config.get('database.ssl') ? { rejectUnauthorized: false } : false,
      }),
    }),

    // ── Redis / Bull Queue ──────────────────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get('redis.password') || undefined,
        },
      }),
    }),

    // ── Redis Client (global) ──────────────────────────────────
    RedisModule,

    // ── Rate Limiting ──────────────────────────────────────────
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 10  }, // max 10 req/detik
      { name: 'medium', ttl: 10000, limit: 50  }, // max 50 req/10 detik
      { name: 'long',   ttl: 60000, limit: 200 }, // max 200 req/menit
    ]),

    // ── Cron/Scheduler ─────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Feature Modules ────────────────────────────────────────
    AuthModule,
    UsersModule,
    RolesModule,
    DepartmentsModule,
    PositionsModule,
    LocationsModule,
    // Fase 2 — aktif
    AppScheduleModule,
    ClientsModule,
    LeaveModule,
    // Fase 3
    AttendanceModule,
    // Fase 4
    VisitsModule,
    // Fase 5
    TasksModule,
    // Fase 7
    NotificationsModule,
    // Fase 8
    ReportsModule,
    // Fase 9
    ServiceReportsModule,
    // Fase 5.5
    ExpenseClaimsModule,
    // Fase 7.5
    SosModule,
    // W-09
    SettingsModule,
    // W-11
    AnnouncementsModule,
    // Surat Peringatan
    WarningLettersModule,
    // Surat Tugas Digital
    BusinessTripsModule,
    // Realtime WebSocket
    RealtimeModule,
    // Monitoring
    MonitoringModule,
    // Work Type Templates
    TemplatesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
