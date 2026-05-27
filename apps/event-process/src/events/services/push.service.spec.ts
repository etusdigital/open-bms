import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../providers/redis/redis.service';
import { PushService } from './push.service';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MsgopsService } from '../../msgops/msgops.service';
import { EventPublisherService } from '../../event-publisher.service';
import { CacheService } from '../../msgops/cache.service';
import { GEO_PROVIDER_TOKEN } from '@bms/geo';
import { AnalyticsPublisherProvider } from '../../providers/analytics-publisher.provider';
import { PlatformType } from '../interfaces/push.interfaces';

describe('PushService', () => {
  let service: PushService;

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
    updateContactDevices: jest.fn().mockResolvedValue({}),
    saveEventsLogs: jest.fn().mockResolvedValue({}),
  };
  const mockEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const mockCacheService = { get: jest.fn(), set: jest.fn() };
  const mockGeolocationService = { lookup: jest.fn().mockResolvedValue(null) };
  const mockAnalyticsPublisherProvider = { publish: jest.fn().mockResolvedValue(undefined) };

  afterEach(() => {
    delete process.env.GEO_ENRICHMENT_ENABLED;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.GEO_ENRICHMENT_ENABLED = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CacheService, useValue: mockCacheService },
        { provide: GEO_PROVIDER_TOKEN, useValue: mockGeolocationService },
        { provide: AnalyticsPublisherProvider, useValue: mockAnalyticsPublisherProvider },
      ],
    }).compile();

    service = module.get<PushService>(PushService);
  });

  const makeEvent = (overrides = {}) => ({
    uuid: 'u1',
    timestamp: Date.now(),
    device_id: 'd1',
    event: 'delivered',
    account: 1,
    messageType: 'web-push',
    contactId: 10,
    message: 100,
    ...overrides,
  });

  const makeWebhook = (events: any[], clientInfo = {}) => ({
    platform: PlatformType.WEBPUSH,
    payload: events,
    client_info: { EVENT_IP: '1.2.3.4', EVENT_ORIGIN: '', EVENT_FAMILY: 'Chrome', ...clientInfo },
  });

  describe('processPush', () => {
    it('should return early when payload is undefined', async () => {
      const result = await service.processPush({ payload: undefined } as any);
      expect(result).toBeUndefined();
    });

    it('should call checkPostgresConnection', async () => {
      await service.processPush(makeWebhook([makeEvent()]) as any);
      expect(mockMsgopsService.checkPostgresConnection).toHaveBeenCalled();
    });

    it('should call updateEventStatistics for events with account/message/contactId', async () => {
      const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');
      await service.processPush(makeWebhook([makeEvent()]) as any);
      expect(updateStatsSpy).toHaveBeenCalled();
    });

    it('should skip events missing account', async () => {
      const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');
      await service.processPush(makeWebhook([makeEvent({ account: 0 })]) as any);
      expect(updateStatsSpy).not.toHaveBeenCalled();
    });

    it('should return {} on success', async () => {
      const result = await service.processPush(makeWebhook([makeEvent()]) as any);
      expect(result).toEqual({});
    });
  });

  describe('groupEventsPush', () => {
    it('should group events by event type', () => {
      const events = [
        makeEvent({ event: 'delivered' }),
        makeEvent({ event: 'click' }),
        makeEvent({ event: 'delivered' }),
      ];
      const result = service.groupEventsPush(events as any);
      expect(Object.keys(result)).toEqual(['delivered', 'click']);
      expect(result['delivered']).toHaveLength(2);
    });

    it('should skip events without account/message/contactId', () => {
      const result = service.groupEventsPush([makeEvent({ account: 0 })] as any);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should return empty object for empty payload', () => {
      const result = service.groupEventsPush([]);
      expect(result).toEqual({});
    });
  });

  describe('processEventsPush', () => {
    it('should return early when payload is empty', async () => {
      const result = await service.processEventsPush('delivered', [], 1);
      expect(result).toBeUndefined();
    });

    it('should return early when accountId is falsy', async () => {
      await service.processEventsPush('delivered', [makeEvent()] as any, 0);
      expect(mockFormatterUtils.logInfo).toHaveBeenCalled();
    });

    it('should set lastDelivered and isActive for delivered events', async () => {
      await service.processEventsPush('delivered', [makeEvent()] as any, 1);
      expect(mockMsgopsService.updateContactDevices).toHaveBeenCalledWith(
        ['d1'],
        1,
        expect.objectContaining({ isActive: true }),
      );
    });

    it('should set lastSent for sent events', async () => {
      await service.processEventsPush('sent', [makeEvent({ event: 'sent' })] as any, 1);
      expect(mockMsgopsService.updateContactDevices).toHaveBeenCalledWith(
        ['d1'],
        1,
        expect.objectContaining({ lastSent: expect.any(Date) }),
      );
    });

    it('should set lastClick and isActive for click events', async () => {
      await service.processEventsPush('click', [makeEvent({ event: 'click' })] as any, 1);
      expect(mockMsgopsService.updateContactDevices).toHaveBeenCalledWith(
        ['d1'],
        1,
        expect.objectContaining({ lastClick: expect.any(Date), isActive: true }),
      );
    });

    it('should set isActive=false for bounce events', async () => {
      await service.processEventsPush('bounce', [makeEvent({ event: 'bounce' })] as any, 1);
      expect(mockMsgopsService.updateContactDevices).toHaveBeenCalledWith(
        ['d1'],
        1,
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should return early for unrecognized event types', async () => {
      const result = await service.processEventsPush('unknown', [makeEvent()] as any, 1);
      expect(result).toBeUndefined();
      expect(mockMsgopsService.updateContactDevices).not.toHaveBeenCalled();
    });
  });

  describe('saveLogsPush', () => {
    it('should return early when pushEvents is empty', async () => {
      await service.saveLogsPush({ payload: [], client_info: {} } as any);
      expect(mockAnalyticsPublisherProvider.publish).not.toHaveBeenCalled();
    });

    it('should return early when first event missing account', async () => {
      await service.saveLogsPush({ payload: [makeEvent({ account: 0 })], client_info: {} } as any);
      expect(mockFormatterUtils.logInfo).toHaveBeenCalled();
    });

    it('should call sendAnalyticsEvent and saveEventsLogs with formatted values', async () => {
      await service.saveLogsPush(makeWebhook([makeEvent()]) as any);
      expect(mockAnalyticsPublisherProvider.publish).toHaveBeenCalled();
      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalled();
    });

    it('should call getGeoIpInfo for delivered events when EVENT_IP is present', async () => {
      await service.saveLogsPush(makeWebhook([makeEvent({ event: 'delivered' })]) as any);
      expect(mockGeolocationService.lookup).toHaveBeenCalled();
    });

    it('should not call getGeoIpInfo for sent events', async () => {
      await service.saveLogsPush(makeWebhook([makeEvent({ event: 'sent' })]) as any);
      expect(mockGeolocationService.lookup).not.toHaveBeenCalled();
    });
  });
});
