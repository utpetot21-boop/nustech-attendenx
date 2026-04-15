import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScheduleSwapRequestEntity } from './entities/schedule-swap-request.entity';
import { UserScheduleEntity } from '../schedule/entities/user-schedule.entity';
import { UserEntity } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

import { ScheduleSwapService } from './schedule-swap.service';
import { ScheduleSwapController } from './schedule-swap.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduleSwapRequestEntity,
      UserScheduleEntity,
      UserEntity,
    ]),
    NotificationsModule,
  ],
  controllers: [ScheduleSwapController],
  providers: [ScheduleSwapService],
  exports: [ScheduleSwapService],
})
export class ScheduleSwapModule {}
