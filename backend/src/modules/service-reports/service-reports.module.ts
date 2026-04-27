import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ServiceReportsController } from './service-reports.controller';
import { ServiceReportsService } from './service-reports.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ServiceReportEntity } from '../visits/entities/service-report.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { VisitPhotoEntity } from '../visits/entities/visit-photo.entity';
import { StorageService } from '../../services/storage.service';
import { EmailService } from '../notifications/email.service';
import { CompanyProfileEntity } from '../settings/entities/company-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceReportEntity, VisitEntity, VisitPhotoEntity, CompanyProfileEntity]),
    MulterModule.register({ dest: '/tmp' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwtSecret'),
      }),
    }),
  ],
  controllers: [ServiceReportsController],
  providers: [ServiceReportsService, PdfGeneratorService, StorageService, EmailService],
  exports: [ServiceReportsService],
})
export class ServiceReportsModule {}
