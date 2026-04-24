import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountApiKeyEntity } from '../../entities/account-api-key.entity';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { RoleEntity } from '../../entities/role.entity';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { UserEntity } from '../../entities/users.entity';
import { AuthzService } from './authz.service';
import { PermissionGuard } from './permission.guard';
import { PrincipalContextGuard } from './principal-context.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, UserAccountEntity, RoleEntity, AccountApiKeyEntity, AccountConfigEntity]), forwardRef(() => AuthModule)],
  providers: [
    AuthzService,
    {
      provide: APP_GUARD,
      useClass: PrincipalContextGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
  exports: [AuthzService],
})
export class AuthzModule {}
