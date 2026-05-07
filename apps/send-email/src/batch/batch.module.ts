import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { MailModule } from '../mail/mail.module';
import { StorageModule } from '../storage/storage.module';
import { FormatterUtils } from '../utils/formatter.utils';
import { TrackerModule } from '../tracker/tracker.module';
import { RedisModule } from '../providers/redis/redis.module';
import { EmailProvidersModule } from '../handlers/email-providers.module';

@Module({
  imports: [ConfigModule.forRoot(), MailModule, StorageModule, TrackerModule, RedisModule, EmailProvidersModule],
  controllers: [BatchController],
  providers: [BatchService, FormatterUtils],
})
export class BatchModule {}
