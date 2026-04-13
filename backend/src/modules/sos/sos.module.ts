import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SosController } from './sos.controller';
import { SosService } from './sos.service';
import { SosGateway } from './sos.gateway';
import { SosAlertEntity } from './entities/sos-alert.entity';
import { SosLocationTrackEntity } from './entities/sos-location-track.entity';
import { EmergencyContactEntity } from './entities/emergency-contact.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SosAlertEntity, SosLocationTrackEntity, EmergencyContactEntity]),
    NotificationsModule,
  ],
  controllers: [SosController],
  providers: [SosService, SosGateway],
  exports: [SosService, SosGateway],
})
export class SosModule {}
