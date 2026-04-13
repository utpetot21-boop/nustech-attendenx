import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyAttendanceConfigEntity } from './entities/company-attendance-config.entity';
import { CompanyProfileEntity } from './entities/company-profile.entity';
import { BackupHistoryEntity } from './entities/backup-history.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { BackupJob } from './jobs/backup.job';
import { StorageService } from '../../services/storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyAttendanceConfigEntity,
      CompanyProfileEntity,
      BackupHistoryEntity,
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService, BackupJob, StorageService],
  exports: [SettingsService],
})
export class SettingsModule {}
