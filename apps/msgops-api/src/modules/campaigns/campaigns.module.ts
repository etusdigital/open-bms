import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleCloudStorageProvider } from '../../providers/google-cloud-storage.provider';
import { GoogleTasksProvider } from '../../providers/google-tasks.provider';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { UtilsService } from '../../utils/utils.service';
import { GlockModule } from './glock/news.glock.module';
import { CampaignEntity } from '../../entities/campaign.entity';
import { RedisModule } from '../../providers/redis.provider';
import { CampaignMessageEntity } from '../../entities/campaign-message.entity';
import { ContactEntity } from 'src/entities/contact.entity';
import { ContactDeviceEntity } from 'src/entities/contact-device.entity';
import { CampaignContactEntity } from 'src/entities/campaign-contact.entity';
import { TagEntity } from 'src/entities/tag.entity';
import { AccountEntity } from 'src/entities/account.entity';
import { PubSubProvider } from 'src/providers/pubsub.providers';
import { SlackProvider } from 'src/providers/slack.provider';
import { LabelsIntegrationModule } from '../labels/labels-integration.module';

@Module({
  imports: [
    HttpModule,
    GlockModule,
    LabelsIntegrationModule,
    TypeOrmModule.forFeature([CampaignEntity, CampaignMessageEntity, ContactEntity, ContactDeviceEntity, CampaignContactEntity, TagEntity, AccountEntity]),
    RedisModule.register({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
    }),
  ],
  controllers: [CampaignsController],
  exports: [CampaignsService],
  providers: [CampaignsService, UtilsService, GoogleCloudStorageProvider, GoogleTasksProvider, PubSubProvider, SlackProvider],
})
export class CampaignModule {}
