import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './providers/redis/redis.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormatterUtils } from './utils/formatter.utils';
import { TrackerModule } from './tracker/tracker.module';
import { SplitFeature } from './features/split/split.feature';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { BatchModule } from './batch/batch.module';
import { SendEmailConsumerService } from './send-email-consumer.service';
import { HtmlToTextModule } from './html-to-text/html-to-text.module';
import { MessagingModule } from './messaging.module';
import { EmailProvidersModule } from './handlers/email-providers.module';

@Module({
  imports: [ConfigModule.forRoot(), MessagingModule, RedisModule, HtmlToTextModule, TrackerModule, MailModule, StorageModule, BatchModule, EmailProvidersModule],
  controllers: [AppController],
  providers: [AppService, FormatterUtils, SendEmailConsumerService, SplitFeature],
})
export class AppModule {}
