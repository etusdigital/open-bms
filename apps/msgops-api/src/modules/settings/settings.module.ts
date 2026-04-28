import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { AccountConfigsProvider } from '../../providers/account-configs.provider';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SendgridHandler } from '../../handlers/email/sendgrid/sendgrid.handler';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([SystemConfigEntity, AccountConfigEntity])],
  controllers: [SettingsController],
  providers: [SettingsService, SendgridHandler, AccountConfigsProvider],
  exports: [SettingsService],
})
export class SettingsModule {}
