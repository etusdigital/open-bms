import { BadRequestException, Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CustomEventRequest,
  InternalRequest,
  SendgridEvent,
  SparkPostEnvelope,
  TwilioEvent,
} from './events/interfaces/events.interfaces';
import { PushPayload, PushWebhook } from './events/interfaces/push.interfaces';
import { PlatformType } from './events/interfaces/push.interfaces';
import { FormatterUtils } from './utils/formatter.utils';
import { SendgridService } from './events/services/sendgrid.service';
import { SparkpostService } from './events/services/sparkpost.service';
import { PushService } from './events/services/push.service';
import { TwilioService } from './events/services/twilio.service';
import { CustomEventsService } from './events/services/custom-events.service';
import { EventsService } from './events/services/events.service';
import { InternalEventsService } from './events/services/internal-events.service';

@Controller('internal/event')
export class AppController {
  constructor(
    private readonly formatterUtils: FormatterUtils,
    private readonly eventsService: EventsService,
    private readonly sendgridService: SendgridService,
    private readonly sparkpostService: SparkpostService,
    private readonly pushService: PushService,
    private readonly twilioService: TwilioService,
    private readonly customEventsService: CustomEventsService,
    private readonly internalEventsService: InternalEventsService,
  ) {}

  private assertAuth(token: string): void {
    if (token !== process.env.INTERNAL_AUTH_TOKEN) {
      throw new UnauthorizedException();
    }
  }

  // SparkPost authenticates its outbound webhooks with HTTP Basic Auth
  // (configured in the SparkPost console). We verify the credentials
  // BEFORE the internal-token check so a forged x-internal-token from
  // inside the perimeter still cannot inject SparkPost-shaped payloads.
  private assertSparkpostBasicAuth(authHeader: string | undefined): void {
    const user = process.env.SPARKPOST_WEBHOOK_USER;
    const pass = process.env.SPARKPOST_WEBHOOK_PASS;
    if (!user || !pass) {
      // Env unset = bypass, lets dev/staging accept calls without basic auth.
      // Production deployments MUST set both vars.
      return;
    }
    if (!authHeader || !authHeader.toLowerCase().startsWith('basic ')) {
      throw new UnauthorizedException('Missing SparkPost basic auth');
    }
    const decoded = Buffer.from(authHeader.slice(6).trim(), 'base64').toString('utf8');
    const expected = `${user}:${pass}`;
    if (decoded.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(decoded), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid SparkPost basic auth');
    }
  }

  // Deterministic idempotency key. AMQP redelivery preserves payload content,
  // so a content hash dedupes retries the same way Pub/Sub messageId did.
  private idempotencyKey(payload: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  @Post('sendgrid')
  async sendgrid(@Headers('x-internal-token') token: string, @Body() events: SendgridEvent): Promise<any> {
    this.assertAuth(token);
    if (!events) throw new BadRequestException('Body cannot be empty');
    return await this.eventsService.processWithIdempotency(this.idempotencyKey(events), () =>
      this.sendgridService.processSendgrid(events),
    );
  }

  @Post('sparkpost')
  async sparkpost(
    @Headers('x-internal-token') token: string,
    @Headers('authorization') authorization: string,
    @Body() events: SparkPostEnvelope | SparkPostEnvelope[],
  ): Promise<any> {
    this.assertSparkpostBasicAuth(authorization);
    this.assertAuth(token);
    if (!events) throw new BadRequestException('Body cannot be empty');
    // SparkPost batches events as an array of envelopes per webhook POST,
    // but a degenerate single-event delivery wraps the envelope directly.
    const envelopes = Array.isArray(events) ? events : [events];
    return await this.eventsService.processWithIdempotency(this.idempotencyKey(envelopes), () =>
      this.sparkpostService.processSparkPost({ payload: envelopes, platform: PlatformType.EMAIL }),
    );
  }

  @Post('twilio')
  async twilio(@Headers('x-internal-token') token: string, @Body() events: TwilioEvent): Promise<any> {
    this.assertAuth(token);
    if (!events) throw new BadRequestException('Body cannot be empty');
    return await this.eventsService.processWithIdempotency(this.idempotencyKey(events), () =>
      this.twilioService.processTwilioNotification(events),
    );
  }

  @Post('push')
  async push(@Headers('x-internal-token') token: string, @Body() events: PushWebhook | PushPayload[]): Promise<any> {
    this.assertAuth(token);
    if (!events) throw new BadRequestException('Body cannot be empty');
    return await this.eventsService.processWithIdempotency(this.idempotencyKey(events), () => {
      if (Array.isArray(events)) {
        return this.pushService.processPush({ payload: events as PushPayload[] } as PushWebhook);
      }
      return this.pushService.processPush(events as PushWebhook);
    });
  }

  @Post('custom')
  async custom(@Headers('x-internal-token') token: string, @Body() events: CustomEventRequest): Promise<any> {
    this.assertAuth(token);
    if (!events) throw new BadRequestException('Body cannot be empty');
    try {
      return await this.eventsService.processWithIdempotency(this.idempotencyKey(events), () =>
        this.customEventsService.customEventsProcess(events),
      );
    } catch (error) {
      this.formatterUtils.logInfo(
        `Error processing custom events: ${JSON.stringify(error)} - payload: ${JSON.stringify(events)}`,
      );
      throw new BadRequestException('Error processing custom events');
    }
  }

  @Post('internal')
  async internal(@Headers('x-internal-token') token: string, @Body() events: InternalRequest): Promise<any> {
    this.assertAuth(token);
    if (!events) throw new BadRequestException('Body cannot be empty');
    try {
      return await this.eventsService.processWithIdempotency(this.idempotencyKey(events), () =>
        this.internalEventsService.internalEventsProcess(events),
      );
    } catch (error) {
      this.formatterUtils.logInfo(
        `Error processing internal events: ${JSON.stringify(error)} - payload: ${JSON.stringify(events)}`,
      );
      throw new BadRequestException('Error processing internal events');
    }
  }
}
