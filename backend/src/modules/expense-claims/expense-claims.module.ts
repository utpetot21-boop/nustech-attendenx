import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ExpenseClaimsController } from './expense-claims.controller';
import { ExpenseClaimsService } from './expense-claims.service';
import { ExpenseClaimEntity } from './entities/expense-claim.entity';
import { ExpenseConfigEntity } from './entities/expense-config.entity';
import { UserEntity } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageService } from '../../services/storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpenseClaimEntity, ExpenseConfigEntity, UserEntity]),
    MulterModule.register({ dest: '/tmp' }),
    NotificationsModule,
  ],
  controllers: [ExpenseClaimsController],
  providers: [ExpenseClaimsService, StorageService],
  exports: [ExpenseClaimsService],
})
export class ExpenseClaimsModule {}
