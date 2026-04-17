import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { UserEntity } from '../../entities/users.entity';
import { UserActivityEntity } from '../../entities/user-activity.entity';
import { Auth0Provider } from '../../providers/auth0.provider';
import { GoogleCloudStorageProvider } from '../../providers/google-cloud-storage.provider';
import { BucketsService } from '../buckets/buckets.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthzModule } from '../authz/authz.module';
import { RoleEntity } from '../../entities/role.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([UserEntity, UserAccountEntity, RoleEntity, UserActivityEntity]), AccountsModule, AuthzModule],
  controllers: [UsersController],
  providers: [UsersService, Auth0Provider, GoogleCloudStorageProvider, BucketsService],
  exports: [UsersService],
})
export class UsersModule {}
