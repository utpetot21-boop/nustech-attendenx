import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VisitEntity } from './entities/visit.entity';
import { VisitPhotoEntity } from './entities/visit-photo.entity';
import { ServiceReportEntity } from './entities/service-report.entity';
import { SlaBreachEntity } from './entities/sla-breach.entity';
import { ClientEntity } from '../clients/entities/client.entity';
import { VisitFormResponseEntity } from '../templates/entities/visit-form-response.entity';
import { TemplatePhotoRequirementEntity } from '../templates/entities/template-photo-requirement.entity';
import { TaskEntity } from '../tasks/entities/task.entity';
import { TaskHoldEntity } from '../tasks/entities/task-hold.entity';
import { AuditLogEntity } from '../audit/entities/audit-log.entity';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { StorageService } from '../../services/storage.service';
import { NominatimService } from '../../services/nominatim.service';
import { OsrmService } from '../../services/osrm.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([
      VisitEntity,
      VisitPhotoEntity,
      ServiceReportEntity,
      SlaBreachEntity,
      ClientEntity,
      VisitFormResponseEntity,
      TemplatePhotoRequirementEntity,
      TaskEntity,
      TaskHoldEntity,
      AuditLogEntity,
    ]),
  ],
  controllers: [VisitsController],
  providers: [
    VisitsService,
    StorageService,
    NominatimService,
    OsrmService,
  ],
  exports: [VisitsService],
})
export class VisitsModule {}
