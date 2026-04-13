import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessTripEntity } from './entities/business-trip.entity';
import { BusinessTripsController } from './business-trips.controller';
import { BusinessTripsService } from './business-trips.service';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessTripEntity])],
  controllers: [BusinessTripsController],
  providers: [BusinessTripsService],
  exports: [BusinessTripsService],
})
export class BusinessTripsModule {}
