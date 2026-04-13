import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { NotificationEntity } from './entities/notification.entity';
import { UserEntity } from '../users/entities/user.entity';

import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { FcmService } from './fcm.service';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppProcessor } from './whatsapp.processor';
import { EmailService } from './email.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, UserEntity]),
    BullModule.registerQueue({ name: 'whatsapp' }),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    FcmService,
    WhatsAppService,
    WhatsAppProcessor,
    EmailService,
  ],
  exports: [NotificationsService, FcmService, WhatsAppService, EmailService],
})
export class NotificationsModule {}
