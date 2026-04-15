import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnouncementEntity } from './entities/announcement.entity';
import { AnnouncementReadEntity } from './entities/announcement-read.entity';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementExpiryJob } from './jobs/announcement-expiry.job';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserEntity } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnnouncementEntity, AnnouncementReadEntity, UserEntity]),
    NotificationsModule,
  ],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, AnnouncementExpiryJob],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
