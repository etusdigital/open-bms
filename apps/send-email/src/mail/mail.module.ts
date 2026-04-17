import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '../storage/storage.module';
import { MailService } from './mail.service';
import { MailUtils } from './mail.utils';
import { FormatterUtils } from '../utils/formatter.utils';
import { SparkPostHandler } from '../handlers/sparkpost/sparkPost.handler';
import { TrackerModule } from '../tracker/tracker.module';
import { SendGridKeyRegistry } from './sendgrid-key-registry';

@Module({
  imports: [ConfigModule.forRoot(), StorageModule, TrackerModule],
  exports: [MailService, MailUtils],
  providers: [MailService, MailUtils, FormatterUtils, SendGridKeyRegistry, SparkPostHandler],
})
export class MailModule {}
