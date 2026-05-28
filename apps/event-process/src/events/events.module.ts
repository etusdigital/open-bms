import { Module } from '@nestjs/common';
import { EventsService } from './services/events.service';
import { SendgridService } from './services/sendgrid.service';
import { SparkpostService } from './services/sparkpost.service';
import { MailerSendService } from './services/mailersend.service';
import { ResendService } from './services/resend.service';
import { SesService } from './services/ses.service';
import { MandrillService } from './services/mandrill.service';
import { PushService } from './services/push.service';
import { TwilioService } from './services/twilio.service';
import { WhatsappCloudService } from './services/whatsapp-cloud.service';
import { FormatterUtils } from '../utils/formatter.utils';
import { MsgopsModule } from '../msgops/msgops.module';
import { RedisModule } from '../providers/redis/redis.module';
import { CacheService } from '../msgops/cache.service';
import { GeoModule } from '@bms/geo';
import { AnalyticsPublisherProvider } from '../providers/analytics-publisher.provider';
import { InternalEventsService } from './services/internal-events.service';

@Module({
  imports: [MsgopsModule, RedisModule, GeoModule.register()],
  providers: [
    FormatterUtils,
    EventsService,
    SendgridService,
    SparkpostService,
    MailerSendService,
    ResendService,
    SesService,
    MandrillService,
    PushService,
    TwilioService,
    WhatsappCloudService,
    InternalEventsService,
    CacheService,
    AnalyticsPublisherProvider,
  ],
  exports: [
    EventsService,
    SendgridService,
    SparkpostService,
    MailerSendService,
    ResendService,
    SesService,
    MandrillService,
    PushService,
    TwilioService,
    WhatsappCloudService,
    InternalEventsService,
  ],
})
export class EventsModule {}
