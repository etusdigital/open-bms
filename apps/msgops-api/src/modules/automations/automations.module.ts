import { TestsModule } from './../tests/tests.module';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../../providers/redis.provider';

import { AccountConfigEntity } from '../../entities/account-config.entity';
import { AccountConfigsProvider } from '../../providers/account-configs.provider';
import { MessageEntity } from '../../entities/message.entity';
import { AutomationEntity } from './../../entities/automation.entity';
import { MessagesService } from '../messages/messages.service';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { S3StorageProvider } from '../../providers/s3-storage.provider';
import { AuditEntity } from '../../entities/audit.entity';
import { AuditService } from './../../utils/audits/audit.service';
import { UtilsModule } from '../../utils/utils.module';
import { AccountsModule } from '../accounts/accounts.module';
import { FormatterUtils } from 'src/utils/pubSub/formatter.utils';
import { ActiveCampaignProvider } from 'src/providers/active-campaign.provider';
import { CampaignModule } from '../campaigns/campaigns.module';
import { TwilioHandler } from 'src/handlers/twilio/twilio.handler';
import { EmailsLabelsEntity } from '../../entities/emails-labels.entity';
import { OpenAIProvider } from 'src/providers/openai.provider';
import { AutomationTargetEntity } from 'src/entities/automation-target.entity';
import { LabelsIntegrationModule } from '../labels/labels-integration.module';
import { BucketsService } from '../buckets/buckets.service';
import { WhatsappTemplatesModule } from '../whatsapp-templates/whatsapp-templates.module';

@Module({
  imports: [
    AccountsModule,
    CampaignModule,
    HttpModule,
    TestsModule,
    UtilsModule,
    LabelsIntegrationModule,
    WhatsappTemplatesModule,
    TypeOrmModule.forFeature([AccountConfigEntity, AutomationEntity, MessageEntity, AuditEntity, EmailsLabelsEntity, AutomationTargetEntity]),
    RedisModule.register({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
    }),
  ],
  providers: [
    AccountConfigsProvider,
    AutomationsService,
    MessagesService,
    S3StorageProvider,
    AuditService,
    TwilioHandler,
    FormatterUtils,
    ActiveCampaignProvider,
    OpenAIProvider,
    BucketsService,
  ],
  exports: [AutomationsService, MessagesService, S3StorageProvider, AuditService],
  controllers: [AutomationsController],
})
export class AutomationsModule {}
