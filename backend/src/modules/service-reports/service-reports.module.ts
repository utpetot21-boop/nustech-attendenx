import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ServiceReportsController } from './service-reports.controller';
import { ServiceReportsService } from './service-reports.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ServiceReportEntity } from '../visits/entities/service-report.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { VisitPhotoEntity } from '../visits/entities/visit-photo.entity';
import { StorageService } from '../../services/storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceReportEntity, VisitEntity, VisitPhotoEntity]),
    MulterModule.register({ dest: '/tmp' }),
  ],
  controllers: [ServiceReportsController],
  providers: [ServiceReportsService, PdfGeneratorService, StorageService],
  exports: [ServiceReportsService],
})
export class ServiceReportsModule {}
