import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';
import { EventsService } from './events/services/events.service';
import { SendgridService } from './events/services/sendgrid.service';
import { SparkpostService } from './events/services/sparkpost.service';
import { MailerSendService } from './events/services/mailersend.service';
import { ResendService } from './events/services/resend.service';
import { SesService } from './events/services/ses.service';
import { MandrillService } from './events/services/mandrill.service';
import { PushService } from './events/services/push.service';
import { TwilioService } from './events/services/twilio.service';
import { InternalEventsService } from './events/services/internal-events.service';
import { FormatterUtils } from './utils/formatter.utils';
import { PlatformType } from './events/interfaces/push.interfaces';

const VALID_TOKEN = 'dev-event-process-token-change-me-please';

describe('AppController', () => {
  let controller: AppController;

  const mockFormatterUtils = { logInfo: jest.fn() };
  const mockEventsService = { processWithIdempotency: jest.fn().mockImplementation((_id, fn) => fn()) };
  const mockSendgridService = { processSendgrid: jest.fn().mockResolvedValue({}) };
  const mockSparkpostService = { processSparkPost: jest.fn().mockResolvedValue({}) };
  const mockMailerSendService = { processMailerSend: jest.fn().mockResolvedValue({}) };
  const mockResendService = { processResend: jest.fn().mockResolvedValue({}) };
  const mockSesService = { processSes: jest.fn().mockResolvedValue({}) };
  const mockMandrillService = { processMandrill: jest.fn().mockResolvedValue({}) };
  const mockPushService = { processPush: jest.fn().mockResolvedValue({}) };
  const mockTwilioService = { processTwilioNotification: jest.fn().mockResolvedValue({}) };
  const mockInternalEventsService = { internalEventsProcess: jest.fn().mockResolvedValue({}) };

  beforeEach(async () => {
    process.env.INTERNAL_AUTH_TOKEN = VALID_TOKEN;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: FormatterUtils, useValue: mockFormatterUtils },
        { provide: EventsService, useValue: mockEventsService },
        { provide: SendgridService, useValue: mockSendgridService },
        { provide: SparkpostService, useValue: mockSparkpostService },
        { provide: MailerSendService, useValue: mockMailerSendService },
        { provide: ResendService, useValue: mockResendService },
        { provide: SesService, useValue: mockSesService },
        { provide: MandrillService, useValue: mockMandrillService },
        { provide: PushService, useValue: mockPushService },
        { provide: TwilioService, useValue: mockTwilioService },
        { provide: InternalEventsService, useValue: mockInternalEventsService },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  describe('auth guard', () => {
    it('rejects when token is missing', async () => {
      await expect(controller.sendgrid(undefined as any, {} as any)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when token is wrong', async () => {
      await expect(controller.sendgrid('wrong', {} as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /internal/event/sendgrid', () => {
    it('throws when body is empty', async () => {
      await expect(controller.sendgrid(VALID_TOKEN, undefined as any)).rejects.toThrow(BadRequestException);
    });

    it('delegates to sendgridService with content-hashed idempotency key', async () => {
      const events = { platform: PlatformType.SENDGRID, payload: [], account: 'acct' };
      await controller.sendgrid(VALID_TOKEN, events as any);

      expect(mockEventsService.processWithIdempotency).toHaveBeenCalledWith(expect.any(String), expect.any(Function));
      expect(mockSendgridService.processSendgrid).toHaveBeenCalledWith(events);
    });
  });

  describe('POST /internal/event/twilio', () => {
    it('delegates to twilioService', async () => {
      const events = { platform: PlatformType.TWILIO, payload: {}, categories: {} };
      await controller.twilio(VALID_TOKEN, events as any);

      expect(mockTwilioService.processTwilioNotification).toHaveBeenCalledWith(events);
    });
  });

  describe('POST /internal/event/push', () => {
    it('delegates to pushService for object payload', async () => {
      const events = { platform: PlatformType.WEBPUSH, payload: [], client_info: {} };
      await controller.push(VALID_TOKEN, events as any);

      expect(mockPushService.processPush).toHaveBeenCalledWith(events);
    });

    it('wraps array payload in PushWebhook shape', async () => {
      const events = [{ event: 'click' }];
      await controller.push(VALID_TOKEN, events as any);

      expect(mockPushService.processPush).toHaveBeenCalledWith(expect.objectContaining({ payload: events }));
    });
  });

  describe('POST /internal/event/internal', () => {
    it('delegates to internalEventsService', async () => {
      const events = { platform: PlatformType.INTERNALEVENTS, payload: [] };
      await controller.internal(VALID_TOKEN, events as any);

      expect(mockInternalEventsService.internalEventsProcess).toHaveBeenCalledWith(events);
    });

    it('throws BadRequestException on error', async () => {
      mockInternalEventsService.internalEventsProcess.mockRejectedValueOnce(new Error('fail'));
      const events = { platform: PlatformType.INTERNALEVENTS, payload: [] };

      await expect(controller.internal(VALID_TOKEN, events as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /internal/event/sparkpost', () => {
    afterEach(() => {
      delete process.env.SPARKPOST_WEBHOOK_USER;
      delete process.env.SPARKPOST_WEBHOOK_PASS;
    });

    it('throws when body is empty', async () => {
      await expect(controller.sparkpost(VALID_TOKEN, undefined as any, undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('delegates an envelope array to sparkpostService via processWithIdempotency', async () => {
      const envelopes = [
        { msys: { message_event: { type: 'delivery', event_id: 'e1', rcpt_to: 'a@b.com' } } },
        { msys: { track_event: { type: 'open', event_id: 'e2', rcpt_to: 'a@b.com' } } },
      ];

      await controller.sparkpost(VALID_TOKEN, undefined as any, envelopes as any);

      expect(mockEventsService.processWithIdempotency).toHaveBeenCalledWith(expect.any(String), expect.any(Function));
      expect(mockSparkpostService.processSparkPost).toHaveBeenCalledWith(
        expect.objectContaining({ payload: envelopes, platform: PlatformType.EMAIL }),
      );
    });

    it('wraps a single envelope into an array before delegating', async () => {
      const envelope = { msys: { message_event: { type: 'delivery', event_id: 'e1', rcpt_to: 'a@b.com' } } };

      await controller.sparkpost(VALID_TOKEN, undefined as any, envelope as any);

      expect(mockSparkpostService.processSparkPost).toHaveBeenCalledWith(
        expect.objectContaining({ payload: [envelope], platform: PlatformType.EMAIL }),
      );
    });

    it('rejects when SparkPost basic auth env is set and authorization header is missing', async () => {
      process.env.SPARKPOST_WEBHOOK_USER = 'sp';
      process.env.SPARKPOST_WEBHOOK_PASS = 'secret';
      const envelope = { msys: { message_event: { type: 'delivery', event_id: 'e1' } } };

      await expect(controller.sparkpost(VALID_TOKEN, undefined as any, envelope as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects when SparkPost basic auth credentials do not match', async () => {
      process.env.SPARKPOST_WEBHOOK_USER = 'sp';
      process.env.SPARKPOST_WEBHOOK_PASS = 'secret';
      const wrong = 'Basic ' + Buffer.from('sp:nope').toString('base64');
      const envelope = { msys: { message_event: { type: 'delivery', event_id: 'e1' } } };

      await expect(controller.sparkpost(VALID_TOKEN, wrong, envelope as any)).rejects.toThrow(UnauthorizedException);
    });

    it('accepts valid SparkPost basic auth when env is set', async () => {
      process.env.SPARKPOST_WEBHOOK_USER = 'sp';
      process.env.SPARKPOST_WEBHOOK_PASS = 'secret';
      const auth = 'Basic ' + Buffer.from('sp:secret').toString('base64');
      const envelope = { msys: { message_event: { type: 'delivery', event_id: 'e1' } } };

      await controller.sparkpost(VALID_TOKEN, auth, envelope as any);

      expect(mockSparkpostService.processSparkPost).toHaveBeenCalled();
    });

    it('bypasses basic auth when SparkPost env vars are unset (dev mode)', async () => {
      // No SPARKPOST_WEBHOOK_USER / _PASS in env → assertSparkpostBasicAuth returns early
      const envelope = { msys: { message_event: { type: 'delivery', event_id: 'e1' } } };

      await controller.sparkpost(VALID_TOKEN, undefined as any, envelope as any);

      expect(mockSparkpostService.processSparkPost).toHaveBeenCalled();
    });

    it('uses content-hashed idempotency key so identical payloads dedupe', async () => {
      const envelopeA = [{ msys: { message_event: { type: 'delivery', event_id: 'e-A' } } }];
      const envelopeB = [{ msys: { message_event: { type: 'delivery', event_id: 'e-B' } } }];

      await controller.sparkpost(VALID_TOKEN, undefined as any, envelopeA as any);
      await controller.sparkpost(VALID_TOKEN, undefined as any, envelopeA as any);
      await controller.sparkpost(VALID_TOKEN, undefined as any, envelopeB as any);

      const calls = mockEventsService.processWithIdempotency.mock.calls.map(([key]) => key);
      // Same payload twice → same key both times.
      expect(calls[0]).toBe(calls[1]);
      // Different payload → different key.
      expect(calls[0]).not.toBe(calls[2]);
    });

    it('returns skipped result when processWithIdempotency reports duplicate', async () => {
      // Simulate the second call seeing the processed marker already set.
      mockEventsService.processWithIdempotency.mockResolvedValueOnce({
        status: 'skipped',
        message: 'Message already processed',
      });
      const envelope = { msys: { message_event: { type: 'delivery', event_id: 'e-dup' } } };

      const result = await controller.sparkpost(VALID_TOKEN, undefined as any, envelope as any);

      expect(result).toEqual(expect.objectContaining({ status: 'skipped' }));
      expect(mockSparkpostService.processSparkPost).not.toHaveBeenCalled();
    });
  });
});
