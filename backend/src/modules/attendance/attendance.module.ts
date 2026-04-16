import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceEntity } from './entities/attendance.entity';
import { AttendanceViolationEntity } from './entities/attendance-violation.entity';
import { UserScheduleEntity } from '../schedule/entities/user-schedule.entity';
import { LocationEntity } from '../locations/entities/location.entity';
import { NationalHolidayEntity } from '../schedule/entities/national-holiday.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AttendanceRequestEntity } from '../attendance-requests/entities/attendance-request.entity';
import { BusinessTripEntity } from '../business-trips/entities/business-trip.entity';
import { CompanyAttendanceConfigEntity } from '../settings/entities/company-attendance-config.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AutoCheckoutJob } from './auto-checkout.job';
import { AlfaDetectorJob } from './alfa-detector.job';
import { SpReminderJob } from './jobs/sp-reminder.job';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceEntity,
      AttendanceViolationEntity,
      AttendanceRequestEntity,
      UserScheduleEntity,
      LocationEntity,
      NationalHolidayEntity,
      UserEntity,
      BusinessTripEntity,
      CompanyAttendanceConfigEntity,
    ]),
    NotificationsModule,
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AutoCheckoutJob,
    AlfaDetectorJob,
    SpReminderJob,
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
