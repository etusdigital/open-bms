import { SendgridHandler } from './../../handlers/email/sendgrid/sendgrid.handler';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEntity } from '../../entities/campaign.entity';
import { CampaignMessageEntity } from '../../entities/campaign-message.entity';
import { GlockAppsHandler } from '../../handlers/tests/email/glockapps/glockapps.handler';
import { CampaignsService } from '../campaigns/campaigns.service';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';
import { MessagesService } from '../messages/messages.service';
import { AutomationEntity } from '../../entities/automation.entity';
import { MessageEntity } from '../../entities/message.entity';
import { AutomationMessageAccountService } from '../automations-messages-accounts/automations-message-account.service';
import { AutomationMessageAccountEntity } from './../../entities/automation-message-account.entity';
import { S3StorageProvider } from '../../providers/s3-storage.provider';
import { SparkPostHandler } from '../../handlers/email/sparkpost/sparkPost.handler';
import { AuditEntity } from '../../entities/audit.entity';
import { AuditService } from './../../utils/audits/audit.service';
import { AccountsModule } from '../accounts/accounts.module';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { AccountConfigsProvider } from '../../providers/account-configs.provider';
import { ContactEntity } from 'src/entities/contact.entity';
import { ContactDeviceEntity } from 'src/entities/contact-device.entity';
import { CampaignContactEntity } from 'src/entities/campaign-contact.entity';
import { TwilioHandler } from 'src/handlers/twilio/twilio.handler';
import { TagEntity } from 'src/entities/tag.entity';
import { AccountEntity } from 'src/entities/account.entity';
import { EmailsLabelsEntity } from '../../entities/emails-labels.entity';
import { OpenAIProvider } from 'src/providers/openai.provider';
import { SlackProvider } from 'src/providers/slack.provider';
import { LabelsIntegrationModule } from '../labels/labels-integration.module';
import { BucketsService } from '../buckets/buckets.service';
import { WhatsappTemplatesModule } from '../whatsapp-templates/whatsapp-templates.module';

@Module({
  imports: [
    AccountsModule,
    HttpModule,
    LabelsIntegrationModule,
    WhatsappTemplatesModule,
    TypeOrmModule.forFeature([
      AccountEntity,
      AccountConfigEntity,
      AuditEntity,
      AutomationEntity,
      AutomationMessageAccountEntity,
      MessageEntity,
      CampaignEntity,
      CampaignMessageEntity,
      CampaignContactEntity,
      ContactEntity,
      ContactDeviceEntity,
      TagEntity,
      EmailsLabelsEntity,
    ]),
  ],
  providers: [
    AccountConfigsProvider,
    TestsService,
    CampaignsService,
    GlockAppsHandler,
    MessagesService,
    AutomationMessageAccountService,
    SendgridHandler,
    SparkPostHandler,
    S3StorageProvider,
    AuditService,
    TwilioHandler,
    OpenAIProvider,
    SlackProvider,
    BucketsService,
  ],
  exports: [TestsService],
  controllers: [TestsController],
})
export class TestsModule {}
