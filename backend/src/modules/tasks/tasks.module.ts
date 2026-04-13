import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaskEntity } from './entities/task.entity';
import { TaskAssignmentEntity } from './entities/task-assignment.entity';
import { DelegationEntity } from './entities/delegation.entity';
import { TaskHoldEntity } from './entities/task-hold.entity';
import { UserEntity } from '../users/entities/user.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { ClientEntity } from '../clients/entities/client.entity';

import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { DispatchService } from './dispatch.service';
import { OsrmService } from '../../services/osrm.service';
import { AutoAssignJob } from './jobs/auto-assign.job';
import { EscalationJob } from './jobs/escalation.job';
import { HoldAutoApproverJob } from './jobs/hold-auto-approver.job';
import { SlaMonitorJob } from './jobs/sla-monitor.job';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      TaskAssignmentEntity,
      DelegationEntity,
      TaskHoldEntity,
      UserEntity,
      VisitEntity,
      ClientEntity,
    ]),
    NotificationsModule,
    RealtimeModule,
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    DispatchService,
    OsrmService,
    AutoAssignJob,
    EscalationJob,
    HoldAutoApproverJob,
    SlaMonitorJob,
  ],
  exports: [TasksService, DispatchService],
})
export class TasksModule {}
