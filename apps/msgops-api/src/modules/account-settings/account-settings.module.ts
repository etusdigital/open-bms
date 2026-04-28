import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { AccountConfigsProvider } from '../../providers/account-configs.provider';
import { SendgridHandler } from '../../handlers/email/sendgrid/sendgrid.handler';
import { AccountSettingsService } from './account-settings.service';
import { AccountSettingsController } from './account-settings.controller';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([AccountConfigEntity, SystemConfigEntity])],
  controllers: [AccountSettingsController],
  providers: [AccountSettingsService, AccountConfigsProvider, SendgridHandler],
  exports: [AccountSettingsService],
})
export class AccountSettingsModule {}
