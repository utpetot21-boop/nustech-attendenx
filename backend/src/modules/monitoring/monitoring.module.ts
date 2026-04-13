import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { VisitEntity } from '../visits/entities/visit.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { MonitoringController } from './monitoring.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, VisitEntity]),
    RealtimeModule,
  ],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
