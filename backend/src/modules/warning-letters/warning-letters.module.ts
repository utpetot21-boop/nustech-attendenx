import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WarningLetterEntity } from './entities/warning-letter.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AttendanceViolationEntity } from '../attendance/entities/attendance-violation.entity';
import { WarningLettersService } from './warning-letters.service';
import { WarningLettersController } from './warning-letters.controller';
import { StorageService } from '../../services/storage.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarningLetterEntity,
      UserEntity,
      AttendanceViolationEntity,
    ]),
    NotificationsModule,
  ],
  controllers: [WarningLettersController],
  providers: [WarningLettersService, StorageService],
  exports: [WarningLettersService],
})
export class WarningLettersModule {}
