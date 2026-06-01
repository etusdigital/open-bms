import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from '../../entities/account.entity';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { WebPushPublicController } from './web-push-public.controller';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { CustomFieldsEntity } from '../../entities/custom-fields.entity';
import { SendgridHandler } from 'src/handlers/email/sendgrid/sendgrid.handler';
import { AccountConfigsProvider } from 'src/providers/account-configs.provider';
import { S3StorageProvider } from 'src/providers/s3-storage.provider';
import { AccountCacheService } from './account-cache.service';
import { AccountApiKeyEntity } from '../../entities/account-api-key.entity';
import { RoleEntity } from '../../entities/role.entity';
import { ApiKeyRegenService } from './api-key-regen.service';
import { ApiKeyAuditLogEntity } from '../../entities/api-key-audit-log.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([AccountEntity, AccountConfigEntity, CustomFieldsEntity, UserAccountEntity, AccountApiKeyEntity, RoleEntity, ApiKeyAuditLogEntity]),
  ],
  controllers: [AccountsController, WebPushPublicController],
  providers: [AccountsService, AccountConfigsProvider, S3StorageProvider, SendgridHandler, AccountCacheService, ApiKeyRegenService],
  exports: [AccountsService, AccountCacheService],
})
export class AccountsModule {}
