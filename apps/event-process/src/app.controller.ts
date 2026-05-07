import { BadRequestException, Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CustomEventRequest,
  InternalRequest,
  MailerSendRawEvent,
  ResendRawEvent,
  SendgridEvent,
  SparkPostEnvelope,
  TwilioEvent,
} from './events/interfaces/events.interfaces';
import { PushPayload, PushWebhook } from './events/interfaces/push.interfaces';
import { PlatformType } from './events/interfaces/push.interfaces';
import { FormatterUtils } from './utils/formatter.utils';
import { SendgridService } from './events/services/sendgrid.service';
import { SparkpostService } from './events/services/sparkpost.service';
import { MailerSendService } from './events/services/mailersend.service';
import { ResendService } from './events/services/resend.service';
import { PushService } from './events/services/push.service';
import { TwilioService } from './events/services/twilio.service';
import { CustomEventsService } from './events/services/custom-events.service';
import { EventsService } from './events/services/events.service';
import { InternalEventsService } from './events/services/internal-events.service';
import { Webhook as SvixWebhook } from 'svix';

@Controller('internal/event')
export class AppController {
  constructor(
    private readonly formatterUtils: FormatterUtils,
    private readonly eventsService: EventsService,
    private readonly sendgridService: SendgridService,
    private readonly sparkpostService: SparkpostService,
    private readonly mailerSendService: MailerSendService,
    private readonly resendService: ResendService,
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

  // MailerSend signs each webhook with HMAC SHA-256 over the raw body
  // using the signing secret configured in the MailerSend dashboard.
  // Header: `signature` (hex digest). Bypass when env unset (dev mode);
  // production MUST set MAILERSEND_WEBHOOK_SIGNING_SECRET.
  private assertMailerSendSignature(rawBody: string, signature: string | undefined): void {
    const secret = process.env.MAILERSEND_WEBHOOK_SIGNING_SECRET;
    if (!secret) return;
    if (!signature) throw new UnauthorizedException('Missing MailerSend signature');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid MailerSend signature');
    }
  }

  // Resend uses Svix for webhook delivery; signing follows the standard
  // Svix scheme via headers svix-id / svix-timestamp / svix-signature.
  // Delegate verification to the official `svix` package so we get the
  // tolerance window + multi-secret rotation handling for free.
  private assertResendSvixSignature(
    rawBody: string,
    headers: { 'svix-id'?: string; 'svix-timestamp'?: string; 'svix-signature'?: string },
  ): void {
    const secret = process.env.RESEND_WEBHOOK_SIGNING_SECRET;
    if (!secret) return;
    const wh = new SvixWebhook(secret);
    try {
      wh.verify(rawBody, {
        'svix-id': headers['svix-id'] ?? '',
        'svix-timestamp': headers['svix-timestamp'] ?? '',
        'svix-signature': headers['svix-signature'] ?? '',
      });
    } catch (err: any) {
      throw new UnauthorizedException(`Invalid Resend Svix signature: ${err?.message ?? 'verify failed'}`);
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

  @Post('mailersend')
  async mailersend(
    @Headers('x-internal-token') token: string,
    @Headers('signature') signature: string,
    @Body() events: MailerSendRawEvent | MailerSendRawEvent[],
  ): Promise<any> {
    this.assertMailerSendSignature(JSON.stringify(events ?? ''), signature);
    this.assertAuth(token);
    if (!events) throw new BadRequestException('Body cannot be empty');
    return await this.eventsService.processWithIdempotency(this.idempotencyKey(events), () =>
      this.mailerSendService.processMailerSend({ payload: events, platform: PlatformType.EMAIL }),
    );
  }

  @Post('resend')
  async resend(
    @Headers('x-internal-token') token: string,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Body() event: ResendRawEvent,
  ): Promise<any> {
    this.assertResendSvixSignature(JSON.stringify(event ?? ''), {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
    this.assertAuth(token);
    if (!event) throw new BadRequestException('Body cannot be empty');
    return await this.eventsService.processWithIdempotency(this.idempotencyKey(event), () =>
      this.resendService.processResend({ payload: event, platform: PlatformType.EMAIL }),
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
