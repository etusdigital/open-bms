import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { MailModule } from '../mail/mail.module';
import { StorageModule } from '../storage/storage.module';
import { FormatterUtils } from '../utils/formatter.utils';
import { TrackerModule } from '../tracker/tracker.module';
import { PubSubProvider } from '../providers/pubsub.provider';
import { RedisModule } from '../providers/redis/redis.module';

const configPubSub = {
  provide: PubSubProvider,
  useFactory: () => {
    return new PubSubProvider(process.env.TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER);
  },
};

@Module({
  imports: [ConfigModule.forRoot(), MailModule, StorageModule, TrackerModule, RedisModule],
  controllers: [BatchController],
  providers: [BatchService, FormatterUtils, configPubSub],
})
export class BatchModule {}
