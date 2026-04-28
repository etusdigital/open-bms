import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './providers/redis/redis.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SparkPostHandler } from './handlers/sparkpost/sparkPost.handler';
import { FormatterUtils } from './utils/formatter.utils';
import { TrackerModule } from './tracker/tracker.module';
import { SplitFeature } from './features/split/split.feature';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { BatchModule } from './batch/batch.module';
import { SendEmailConsumerService } from './send-email-consumer.service';
import { HtmlToTextModule } from './html-to-text/html-to-text.module';
import { MessagingModule } from './messaging.module';

@Module({
  imports: [ConfigModule.forRoot(), MessagingModule, RedisModule, HtmlToTextModule, TrackerModule, MailModule, StorageModule, BatchModule],
  controllers: [AppController],
  providers: [AppService, SparkPostHandler, FormatterUtils, SendEmailConsumerService, SplitFeature],
})
export class AppModule {}
