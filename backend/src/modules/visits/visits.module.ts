import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VisitEntity } from './entities/visit.entity';
import { VisitPhotoEntity } from './entities/visit-photo.entity';
import { ServiceReportEntity } from './entities/service-report.entity';
import { SlaBreachEntity } from './entities/sla-breach.entity';
import { ClientEntity } from '../clients/entities/client.entity';
import { VisitFormResponseEntity } from '../templates/entities/visit-form-response.entity';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { PhotoWatermarkService } from './photo-watermark.service';
import { StorageService } from '../../services/storage.service';
import { NominatimService } from '../../services/nominatim.service';
import { OsrmService } from '../../services/osrm.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VisitEntity,
      VisitPhotoEntity,
      ServiceReportEntity,
      SlaBreachEntity,
      ClientEntity,
      VisitFormResponseEntity,
    ]),
  ],
  controllers: [VisitsController],
  providers: [
    VisitsService,
    PhotoWatermarkService,
    StorageService,
    NominatimService,
    OsrmService,
  ],
  exports: [VisitsService],
})
export class VisitsModule {}
