import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from '../../entities/account.entity';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { CustomFieldsEntity } from '../../entities/custom-fields.entity';
import { CustomEventEntity } from '../../entities/custom-event.entity';
import { SendgridHandler } from 'src/handlers/email/sendgrid/sendgrid.handler';
import { AccountConfigsProvider } from 'src/providers/account-configs.provider';
import { GoogleCloudStorageProvider } from 'src/providers/google-cloud-storage.provider';
import { GoogleTasksProvider } from 'src/providers/google-tasks.provider';
import { EvolutionHandler } from 'src/handlers/evolution/evolution.handler';
import { AccountCacheService } from './account-cache.service';
import { AccountApiKeyEntity } from '../../entities/account-api-key.entity';
import { RoleEntity } from '../../entities/role.entity';
import { ApiKeyRegenService } from './api-key-regen.service';
import { ApiKeyAuditLogEntity } from '../../entities/api-key-audit-log.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([AccountEntity, AccountConfigEntity, CustomFieldsEntity, CustomEventEntity, UserAccountEntity, AccountApiKeyEntity, RoleEntity, ApiKeyAuditLogEntity]),
  ],
  controllers: [AccountsController],
  providers: [AccountsService, AccountConfigsProvider, GoogleCloudStorageProvider, GoogleTasksProvider, SendgridHandler, EvolutionHandler, AccountCacheService, ApiKeyRegenService],
  exports: [AccountsService, AccountCacheService],
})
export class AccountsModule {}
