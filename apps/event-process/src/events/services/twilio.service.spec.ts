import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../providers/redis/redis.service';
import { TwilioService } from './twilio.service';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MsgopsService } from '../../msgops/msgops.service';
import { PubSubProvider } from '../../providers/pubsub.provider';
import { CacheService } from '../../msgops/cache.service';
import { GeolocationService } from '../../utils/geolocation/geolocation.service';
import { KafkaProvider } from '../../providers/kafka.provider';
import { PlatformType } from '../interfaces/push.interfaces';

describe('TwilioService', () => {
  let service: TwilioService;

  const mockPipeline = {
    set: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    hincrby: jest.fn().mockReturnThis(),
    hset: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
  };

  const mockRedisClient = {
    pipeline: jest.fn(() => mockPipeline),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
  };

  const mockRedisService = { getOrThrow: jest.fn(() => mockRedisClient) };
  const mockFormatterUtils = {
    logInfo: jest.fn(),
    convertTimestampToTimezone: jest.fn(() => '2024-01-01'),
    removeQueryStringFromUrl: jest.fn((url) => url),
  };
  const mockMsgopsService = {
    checkPostgresConnection: jest.fn(),
    getAccountTimeZone: jest.fn().mockResolvedValue('UTC'),
    updateContactsById: jest.fn().mockResolvedValue({}),
    saveEventsLogs: jest.fn().mockResolvedValue({}),
  };
  const mockPubSubProvider = { sendAsyncMessage: jest.fn(), sendAsyncMessageBms: jest.fn() };
  const mockCacheService = { get: jest.fn(), set: jest.fn() };
  const mockGeolocationService = { getLocation: jest.fn().mockResolvedValue({}) };
  const mockKafkaProvider = { sendAsyncMessage: jest.fn().mockResolvedValue(undefined) };

  const makeEvent = (overrides = {}) => ({
    platform: PlatformType.TWILIO,
    payload: { event: 'sent', ip: null, url: null, headers: {}, ErrorCode: undefined, ...overrides },
    categories: {
      account: 1,
      message: 100,
      contactId: 10,
      message_type: 'sms',
      platform: 'twilio',
      type: 'campaign',
      campaign: 50,
      automation: 0,
      utmcampaign: 'test',
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwilioService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: PubSubProvider, useValue: mockPubSubProvider },
        { provide: CacheService, useValue: mockCacheService },
        { provide: GeolocationService, useValue: mockGeolocationService },
        { provide: KafkaProvider, useValue: mockKafkaProvider },
      ],
    }).compile();

    service = module.get<TwilioService>(TwilioService);
  });

  describe('processTwilioNotification', () => {
    it('should call checkPostgresConnection', async () => {
      await service.processTwilioNotification(makeEvent() as any);
      expect(mockMsgopsService.checkPostgresConnection).toHaveBeenCalled();
    });

    it('should return early when categories missing account', async () => {
      const event = makeEvent();
      event.categories.account = 0;
      await service.processTwilioNotification(event as any);
      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('missing categories'));
    });

    it('should return early when categories missing message', async () => {
      const event = makeEvent();
      event.categories.message = 0;
      await service.processTwilioNotification(event as any);
      expect(mockFormatterUtils.logInfo).toHaveBeenCalled();
    });

    it('should return early when categories missing contactId', async () => {
      const event = makeEvent();
      event.categories.contactId = 0;
      await service.processTwilioNotification(event as any);
      expect(mockFormatterUtils.logInfo).toHaveBeenCalled();
    });

    it('should call updateEventStatistics with correct platform', async () => {
      const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');
      await service.processTwilioNotification(makeEvent() as any);
      expect(updateStatsSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ platform: 'sms' }));
    });

    it('should call getGeoIpInfo for click events', async () => {
      await service.processTwilioNotification(makeEvent({ event: 'click', ip: '1.2.3.4' }) as any);
      expect(mockGeolocationService.getLocation).toHaveBeenCalledWith('1.2.3.4');
    });

    it('should not call getGeoIpInfo for non-click events', async () => {
      await service.processTwilioNotification(makeEvent({ event: 'sent' }) as any);
      expect(mockGeolocationService.getLocation).not.toHaveBeenCalled();
    });

    describe('contact attribute updates', () => {
      it('should set smsLastSent for sent events', async () => {
        await service.processTwilioNotification(makeEvent({ event: 'sent' }) as any);
        expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
          [10],
          1,
          expect.objectContaining({ smsLastSent: expect.any(Date) }),
        );
      });

      it('should set smsLastDelivered for delivered events', async () => {
        await service.processTwilioNotification(makeEvent({ event: 'delivered' }) as any);
        expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
          [10],
          1,
          expect.objectContaining({ smsLastDelivered: expect.any(Date) }),
        );
      });

      it('should set smsLastOpen for read events', async () => {
        await service.processTwilioNotification(makeEvent({ event: 'read' }) as any);
        expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
          [10],
          1,
          expect.objectContaining({ smsLastOpen: expect.any(Date) }),
        );
      });

      it('should set smsLastClick for click events', async () => {
        await service.processTwilioNotification(makeEvent({ event: 'click' }) as any);
        expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
          [10],
          1,
          expect.objectContaining({ smsLastClick: expect.any(Date) }),
        );
      });

      it('should return early for unrecognized event types', async () => {
        const result = await service.processTwilioNotification(makeEvent({ event: 'unknown' }) as any);
        expect(result).toBeUndefined();
        expect(mockMsgopsService.updateContactsById).not.toHaveBeenCalled();
      });
    });

    it('should execute Redis pipeline after processing', async () => {
      await service.processTwilioNotification(makeEvent() as any);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should return {} on success', async () => {
      const result = await service.processTwilioNotification(makeEvent() as any);
      expect(result).toEqual({});
    });

    it('should throw error when msgOpsService throws', async () => {
      mockMsgopsService.updateContactsById.mockRejectedValueOnce(new Error('db error'));
      await expect(service.processTwilioNotification(makeEvent() as any)).rejects.toThrow(
        'Error processing Twilio notification',
      );
    });
  });

  describe('saveLogsTwilio', () => {
    it('should return early for events not in expected list', async () => {
      await (service as any).saveLogsTwilio(makeEvent({ event: 'unknown' }));
      expect(mockKafkaProvider.sendAsyncMessage).not.toHaveBeenCalled();
    });

    it('should call sendKafkaMessage and saveEventsLogs for valid events', async () => {
      await (service as any).saveLogsTwilio(makeEvent({ event: 'delivered' }));
      expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalled();
      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalled();
    });

    it('should include error reason for known error codes', async () => {
      await (service as any).saveLogsTwilio(makeEvent({ event: 'failed', ErrorCode: 30003 }));
      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ reason: 'Unreachable destination handset' })]),
      );
    });

    it('should call getGeoIpInfo for click events in logs', async () => {
      await (service as any).saveLogsTwilio(makeEvent({ event: 'click', ip: '1.2.3.4' }));
      expect(mockGeolocationService.getLocation).toHaveBeenCalled();
    });
  });
});
