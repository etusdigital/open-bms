import { BadRequestException, Body, Controller, Post, Headers } from '@nestjs/common';
import { CustomEventRequest, InternalRequest, SendgridEvent, TwilioEvent } from './events/interfaces/events.interfaces';
import { PlatformType, PushPayload, PushWebhook } from './events/interfaces/push.interfaces';
import { FormatterUtils } from './utils/formatter.utils';
import { SendgridService } from './events/services/sendgrid.service';
import { PushService } from './events/services/push.service';
import { TwilioService } from './events/services/twilio.service';
import { CustomEventsService } from './events/services/custom-events.service';
import { EventsService } from './events/services/events.service';
import { InternalEventsService } from './events/services/internal-events.service';

@Controller()
export class AppController {
  constructor(
    private readonly formatterUtils: FormatterUtils,
    private readonly eventsService: EventsService,
    private readonly sendgridService: SendgridService,
    private readonly pushService: PushService,
    private readonly twilioService: TwilioService,
    private readonly customEventsService: CustomEventsService,
    private readonly internalEventsService: InternalEventsService,
  ) {}

  @Post('/*')
  async processEvent(
    @Body() events: SendgridEvent | TwilioEvent | PushWebhook | CustomEventRequest | InternalRequest,
    @Headers('x-goog-pubsub-message-id') messageId: string,
    @Headers('platform') headerPlatform: PlatformType,
  ): Promise<any> {
    if (!events) {
      throw new BadRequestException('Body cannot be empty');
    }

    const platform = events.platform || headerPlatform;

    if (platform === PlatformType.SENDGRID) {
      return await this.eventsService.processWithIdempotency(messageId, () =>
        this.sendgridService.processSendgrid(events as SendgridEvent),
      );
    }

    if (platform === PlatformType.TWILIO) {
      return await this.eventsService.processWithIdempotency(messageId, () =>
        this.twilioService.processTwilioNotification(events as TwilioEvent),
      );
    }

    if (platform === PlatformType.WEBPUSH || platform === PlatformType.MOBILEPUSH) {
      return await this.eventsService.processWithIdempotency(messageId, () => {
        if (Array.isArray(events)) {
          return this.pushService.processPush({ payload: events as PushPayload[] } as PushWebhook);
        }
        return this.pushService.processPush(events as PushWebhook);
      });
    }

    if (platform === PlatformType.CUSTOMEVENTS) {
      try {
        return await this.eventsService.processWithIdempotency(messageId, () =>
          this.customEventsService.customEventsProcess(events as CustomEventRequest),
        );
      } catch (error) {
        this.formatterUtils.logInfo(
          `Error processing custom events: ${JSON.stringify(error)} - payload: ${JSON.stringify(events)}`,
        );
        throw new BadRequestException('Error processing custom events');
      }
    }

    if (platform === PlatformType.INTERNALEVENTS) {
      try {
        return await this.eventsService.processWithIdempotency(messageId, () =>
          this.internalEventsService.internalEventsProcess(events as InternalRequest),
        );
      } catch (error) {
        this.formatterUtils.logInfo(
          `Error processing internal events: ${JSON.stringify(error)} - payload: ${JSON.stringify(events)}`,
        );
        throw new BadRequestException('Error processing internal events');
      }
    }

    if (platform === PlatformType.SPARKPOST) {
      this.formatterUtils.logInfo(`[Sparkpost] Received event: ${JSON.stringify(events)}`);
      return;
    }

    console.log('Invalid platform: ', JSON.stringify(events));
    throw new BadRequestException('Invalid platform');
  }
}
