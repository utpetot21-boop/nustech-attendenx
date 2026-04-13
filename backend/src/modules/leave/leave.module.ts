import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanyLeaveConfigEntity } from './entities/company-leave-config.entity';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { LeaveRequestEntity } from './entities/leave-request.entity';
import { LeaveBalanceLogEntity } from './entities/leave-balance-log.entity';
import { PendingDeductionEntity } from './entities/pending-deduction.entity';
import { LeaveObjectionEntity } from './entities/leave-objection.entity';
import { UserEntity } from '../users/entities/user.entity';
import { NationalHolidayEntity } from '../schedule/entities/national-holiday.entity';

import { LeaveConfigService } from './leave-config.service';
import { LeaveConfigController } from './leave-config.controller';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { LeaveAccrualJob } from './jobs/leave-accrual.job';
import { LeaveExpiryJob } from './jobs/leave-expiry.job';
import { LeaveExpiryReminderJob } from './jobs/leave-expiry-reminder.job';
import { PendingDeductionJob } from './jobs/pending-deduction.job';
import { CollectiveLeaveJob } from './jobs/collective-leave.job';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyLeaveConfigEntity,
      LeaveBalanceEntity,
      LeaveRequestEntity,
      LeaveBalanceLogEntity,
      PendingDeductionEntity,
      LeaveObjectionEntity,
      UserEntity,
      NationalHolidayEntity,
    ]),
    NotificationsModule,
  ],
  controllers: [LeaveConfigController, LeaveController],
  providers: [
    LeaveConfigService,
    LeaveService,
    LeaveAccrualJob,
    LeaveExpiryJob,
    LeaveExpiryReminderJob,
    PendingDeductionJob,
    CollectiveLeaveJob,
  ],
  exports: [LeaveConfigService, LeaveService],
})
export class LeaveModule {}
