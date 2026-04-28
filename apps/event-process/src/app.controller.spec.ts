import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';
import { EventsService } from './events/services/events.service';
import { SendgridService } from './events/services/sendgrid.service';
import { PushService } from './events/services/push.service';
import { TwilioService } from './events/services/twilio.service';
import { CustomEventsService } from './events/services/custom-events.service';
import { InternalEventsService } from './events/services/internal-events.service';
import { FormatterUtils } from './utils/formatter.utils';
import { PlatformType } from './events/interfaces/push.interfaces';

const VALID_TOKEN = 'dev-event-process-token-change-me-please';

describe('AppController', () => {
  let controller: AppController;

  const mockFormatterUtils = { logInfo: jest.fn() };
  const mockEventsService = { processWithIdempotency: jest.fn().mockImplementation((_id, fn) => fn()) };
  const mockSendgridService = { processSendgrid: jest.fn().mockResolvedValue({}) };
  const mockPushService = { processPush: jest.fn().mockResolvedValue({}) };
  const mockTwilioService = { processTwilioNotification: jest.fn().mockResolvedValue({}) };
  const mockCustomEventsService = { customEventsProcess: jest.fn().mockResolvedValue({}) };
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
        { provide: PushService, useValue: mockPushService },
        { provide: TwilioService, useValue: mockTwilioService },
        { provide: CustomEventsService, useValue: mockCustomEventsService },
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

  describe('POST /internal/event/custom', () => {
    it('delegates to customEventsService', async () => {
      const events = { platform: PlatformType.CUSTOMEVENTS, payload: [] };
      await controller.custom(VALID_TOKEN, events as any);

      expect(mockCustomEventsService.customEventsProcess).toHaveBeenCalledWith(events);
    });

    it('throws BadRequestException on error', async () => {
      mockCustomEventsService.customEventsProcess.mockRejectedValueOnce(new Error('fail'));
      const events = { platform: PlatformType.CUSTOMEVENTS, payload: [] };

      await expect(controller.custom(VALID_TOKEN, events as any)).rejects.toThrow(BadRequestException);
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
    it('logs event and returns undefined (preserves original log-only behavior)', async () => {
      const events = { platform: PlatformType.SPARKPOST };
      const result = await controller.sparkpost(VALID_TOKEN, events as any);

      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Sparkpost'));
      expect(result).toBeUndefined();
    });
  });
});
