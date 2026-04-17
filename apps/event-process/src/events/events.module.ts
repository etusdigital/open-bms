import { Module } from '@nestjs/common';
import { EventsService } from './services/events.service';
import { SendgridService } from './services/sendgrid.service';
import { PushService } from './services/push.service';
import { TwilioService } from './services/twilio.service';
import { CustomEventsService } from './services/custom-events.service';
import { FormatterUtils } from '../utils/formatter.utils';
import { MsgopsModule } from '../msgops/msgops.module';
import { RedisModule } from '../providers/redis/redis.module';
import { PubSubProvider } from '../providers/pubsub.provider';
import { CacheService } from '../msgops/cache.service';
import { GeolocationModule } from '../utils/geolocation/geolocation.module';
import { KafkaProvider } from '../providers/kafka.provider';
import { InternalEventsService } from './services/internal-events.service';

@Module({
  imports: [MsgopsModule, RedisModule, GeolocationModule],
  providers: [
    FormatterUtils,
    PubSubProvider,
    EventsService,
    SendgridService,
    PushService,
    TwilioService,
    CustomEventsService,
    InternalEventsService,
    CacheService,
    KafkaProvider,
  ],
  exports: [EventsService, SendgridService, PushService, TwilioService, CustomEventsService, InternalEventsService],
})
export class EventsModule {}
