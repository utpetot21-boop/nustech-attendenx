import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PasswordResetTokenEntity } from './entities/password-reset-token.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { UserDeviceEntity } from './entities/user-device.entity';
import { UserEntity } from './entities/user.entity';
import { DepartmentEntity } from '../departments/entities/department.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { StorageService } from '../../services/storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      RefreshTokenEntity,
      UserDeviceEntity,
      PasswordResetTokenEntity,
      DepartmentEntity,
    ]),
    forwardRef(() => AuthModule), // circular dep resolution
  ],
  controllers: [UsersController],
  providers: [UsersService, StorageService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
