import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { UserEntity } from '../../entities/users.entity';
import { UserActivityEntity } from '../../entities/user-activity.entity';
import { S3StorageProvider } from '../../providers/s3-storage.provider';
import { BucketsService } from '../buckets/buckets.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthzModule } from '../authz/authz.module';
import { AuthModule } from '../auth/auth.module';
import { RoleEntity } from '../../entities/role.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([UserEntity, UserAccountEntity, RoleEntity, UserActivityEntity]), AccountsModule, AuthzModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService, S3StorageProvider, BucketsService],
  exports: [UsersService],
})
export class UsersModule {}
