import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AppController } from './app.controller';
import { EventsService } from './events/services/events.service';
import { SendgridService } from './events/services/sendgrid.service';
import { PushService } from './events/services/push.service';
import { TwilioService } from './events/services/twilio.service';
import { CustomEventsService } from './events/services/custom-events.service';
import { InternalEventsService } from './events/services/internal-events.service';
import { FormatterUtils } from './utils/formatter.utils';
import { PlatformType } from './events/interfaces/push.interfaces';

describe('AppController', () => {
  let controller: AppController;

  const mockFormatterUtils = {
    logInfo: jest.fn(),
  };

  const mockEventsService = {
    processWithIdempotency: jest.fn().mockImplementation((_id, fn) => fn()),
  };

  const mockSendgridService = {
    processSendgrid: jest.fn().mockResolvedValue({}),
  };

  const mockPushService = {
    processPush: jest.fn().mockResolvedValue({}),
  };

  const mockTwilioService = {
    processTwilioNotification: jest.fn().mockResolvedValue({}),
  };

  const mockCustomEventsService = {
    customEventsProcess: jest.fn().mockResolvedValue({}),
  };

  const mockInternalEventsService = {
    internalEventsProcess: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
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

  describe('POST /*', () => {
    describe('sendgrid platform', () => {
      it('should delegate to sendgridService.processSendgrid', async () => {
        const events = { platform: PlatformType.SENDGRID, payload: [], account: 'acct' };
        await controller.processEvent(events as any, 'msg-1', undefined);

        expect(mockEventsService.processWithIdempotency).toHaveBeenCalledWith('msg-1', expect.any(Function));
        expect(mockSendgridService.processSendgrid).toHaveBeenCalledWith(events);
      });

      it('should use platform from body when header platform is absent', async () => {
        const events = { platform: PlatformType.SENDGRID, payload: [], account: 'acct' };
        await controller.processEvent(events as any, 'msg-2', undefined);

        expect(mockSendgridService.processSendgrid).toHaveBeenCalled();
      });
    });

    describe('twilio platform', () => {
      it('should delegate to twilioService.processTwilioNotification', async () => {
        const events = { platform: PlatformType.TWILIO, payload: {}, categories: {} };
        await controller.processEvent(events as any, 'msg-3', undefined);

        expect(mockEventsService.processWithIdempotency).toHaveBeenCalledWith('msg-3', expect.any(Function));
        expect(mockTwilioService.processTwilioNotification).toHaveBeenCalledWith(events);
      });
    });

    describe('web-push platform', () => {
      it('should delegate to pushService.processPush', async () => {
        const events = { platform: PlatformType.WEBPUSH, payload: [], client_info: {} };
        await controller.processEvent(events as any, 'msg-4', undefined);

        expect(mockPushService.processPush).toHaveBeenCalledWith(events);
      });

      it('should wrap array payload in PushWebhook shape when body is array', async () => {
        const events = [{ event: 'click' }];
        (events as any).platform = PlatformType.WEBPUSH;
        await controller.processEvent(events as any, 'msg-5', PlatformType.WEBPUSH);

        expect(mockPushService.processPush).toHaveBeenCalledWith(expect.objectContaining({ payload: events }));
      });
    });

    describe('mobile-push platform', () => {
      it('should delegate to pushService.processPush', async () => {
        const events = { platform: PlatformType.MOBILEPUSH, payload: [], client_info: {} };
        await controller.processEvent(events as any, 'msg-6', undefined);

        expect(mockPushService.processPush).toHaveBeenCalledWith(events);
      });
    });

    describe('custom_events platform', () => {
      it('should delegate to customEventsService.customEventsProcess', async () => {
        const events = { platform: PlatformType.CUSTOMEVENTS, payload: [] };
        await controller.processEvent(events as any, 'msg-7', undefined);

        expect(mockCustomEventsService.customEventsProcess).toHaveBeenCalledWith(events);
      });

      it('should throw BadRequestException on error', async () => {
        mockCustomEventsService.customEventsProcess.mockRejectedValue(new Error('fail'));
        const events = { platform: PlatformType.CUSTOMEVENTS, payload: [] };

        await expect(controller.processEvent(events as any, 'msg-8', undefined)).rejects.toThrow(BadRequestException);
      });
    });

    describe('internal platform', () => {
      it('should delegate to internalEventsService.internalEventsProcess', async () => {
        const events = { platform: PlatformType.INTERNALEVENTS, payload: [] };
        await controller.processEvent(events as any, 'msg-9', undefined);

        expect(mockInternalEventsService.internalEventsProcess).toHaveBeenCalledWith(events);
      });

      it('should throw BadRequestException on error', async () => {
        mockInternalEventsService.internalEventsProcess.mockRejectedValue(new Error('fail'));
        const events = { platform: PlatformType.INTERNALEVENTS, payload: [] };

        await expect(controller.processEvent(events as any, 'msg-10', undefined)).rejects.toThrow(BadRequestException);
      });
    });

    describe('sparkpost platform', () => {
      it('should log event and return undefined', async () => {
        const events = { platform: PlatformType.SPARKPOST };
        const result = await controller.processEvent(events as any, 'msg-11', undefined);

        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Sparkpost'));
        expect(result).toBeUndefined();
      });
    });

    describe('unknown platform', () => {
      it('should throw BadRequestException', async () => {
        const events = { platform: 'unknown-platform' };

        await expect(controller.processEvent(events as any, 'msg-12', undefined)).rejects.toThrow(BadRequestException);
      });

      it('should prefer body.platform over header platform', async () => {
        const events = { platform: PlatformType.SENDGRID, payload: [], account: 'acct' };
        await controller.processEvent(events as any, 'msg-13', PlatformType.TWILIO);

        expect(mockSendgridService.processSendgrid).toHaveBeenCalled();
        expect(mockTwilioService.processTwilioNotification).not.toHaveBeenCalled();
      });
    });
  });
});
