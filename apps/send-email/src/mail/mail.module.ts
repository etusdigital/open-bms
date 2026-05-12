import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '../storage/storage.module';
import { MailService } from './mail.service';
import { MailUtils } from './mail.utils';
import { FormatterUtils } from '../utils/formatter.utils';
import { SparkPostHandler } from '../handlers/sparkpost/sparkPost.handler';
import { SendGridHandler } from '../handlers/sendgrid/sendGrid.handler';
import { TrackerModule } from '../tracker/tracker.module';

@Module({
  imports: [ConfigModule.forRoot(), StorageModule, TrackerModule],
  exports: [MailService, MailUtils, FormatterUtils, SparkPostHandler, SendGridHandler],
  providers: [MailService, MailUtils, FormatterUtils, SparkPostHandler, SendGridHandler],
})
export class MailModule {}
