import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceRequestEntity } from './entities/attendance-request.entity';
import { AttendanceEntity } from '../attendance/entities/attendance.entity';
import { UserScheduleEntity } from '../schedule/entities/user-schedule.entity';
import { UserEntity } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceRequestsService } from './attendance-requests.service';
import { AttendanceRequestsController } from './attendance-requests.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceRequestEntity,
      AttendanceEntity,
      UserScheduleEntity,
      UserEntity,
    ]),
    NotificationsModule,
  ],
  controllers: [AttendanceRequestsController],
  providers: [AttendanceRequestsService],
  exports: [AttendanceRequestsService],
})
export class AttendanceRequestsModule {}
