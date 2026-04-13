import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ShiftTypeEntity } from './entities/shift-type.entity';
import { OfficeHoursConfigEntity } from './entities/office-hours-config.entity';
import { UserScheduleEntity } from './entities/user-schedule.entity';
import { NationalHolidayEntity } from './entities/national-holiday.entity';
import { ScheduleChangeLogEntity } from './entities/schedule-change-log.entity';
import { UserEntity } from '../users/entities/user.entity';

import { ShiftTypesService } from './shift-types.service';
import { OfficeHoursService } from './office-hours.service';
import { ScheduleGeneratorService } from './schedule-generator.service';
import { UserSchedulesService } from './user-schedules.service';
import { NationalHolidaysService } from './national-holidays.service';
import { ScheduleController } from './schedule.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShiftTypeEntity,
      OfficeHoursConfigEntity,
      UserScheduleEntity,
      NationalHolidayEntity,
      ScheduleChangeLogEntity,
      UserEntity,
    ]),
  ],
  controllers: [ScheduleController],
  providers: [
    ShiftTypesService,
    OfficeHoursService,
    ScheduleGeneratorService,
    UserSchedulesService,
    NationalHolidaysService,
  ],
  exports: [
    ShiftTypesService,
    OfficeHoursService,
    UserSchedulesService,
    NationalHolidaysService,
    ScheduleGeneratorService,
  ],
})
export class ScheduleModule {}
