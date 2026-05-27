import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3StorageProvider } from '../../providers/s3-storage.provider';
import { MessageEntity } from '../../entities/message.entity';
import { AutomationEntity } from '../../entities/automation.entity';
import { TestsModule } from '../tests/tests.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { AuditEntity } from '../../entities/audit.entity';
import { AuditService } from '../../utils/audits/audit.service';
import { RedisModule } from '../../providers/redis.provider';
import { AccountsModule } from '../accounts/accounts.module';
import { CampaignModule } from '../campaigns/campaigns.module';
import { TwilioHandler } from 'src/handlers/twilio/twilio.handler';
import { ValidLinksService } from 'src/utils/utils.service';
import { EmailsLabelsEntity } from '../../entities/emails-labels.entity';
import { OpenAIProvider } from 'src/providers/openai.provider';
import { LabelsIntegrationModule } from '../labels/labels-integration.module';
import { BucketsService } from '../buckets/buckets.service';

@Module({
  imports: [
    HttpModule,
    TestsModule,
    AccountsModule,
    CampaignModule,
    LabelsIntegrationModule,
    TypeOrmModule.forFeature([MessageEntity, AutomationEntity, AuditEntity, EmailsLabelsEntity]),
    RedisModule.register({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
    }),
  ],
  providers: [MessagesService, S3StorageProvider, BucketsService, AuditService, TwilioHandler, ValidLinksService, OpenAIProvider],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
