import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../providers/redis/redis.service';
import { CustomEventsService } from './custom-events.service';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MsgopsService } from '../../msgops/msgops.service';
import { EventPublisherService } from '../../event-publisher.service';
import { CacheService } from '../../msgops/cache.service';
import { GeolocationService } from '../../utils/geolocation/geolocation.service';
import { KafkaProvider } from '../../providers/kafka.provider';
import { PlatformType } from '../interfaces/push.interfaces';

describe('CustomEventsService', () => {
  let service: CustomEventsService;

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
    cleanObject: jest.fn((obj) => obj),
    normalizeTimestamp: jest.fn((ts) => ts),
    convertTimestampToTimezone: jest.fn(() => '2024-01-01'),
  };
  const mockMsgopsService = {
    checkPostgresConnection: jest.fn(),
    findAccountIdByApiKey: jest.fn().mockResolvedValue(1),
    getAccountTimeZone: jest.fn().mockResolvedValue('UTC'),
    findEvent: jest.fn().mockResolvedValue({ id: 42, name: 'test-event' }),
    findContactByEmail: jest.fn().mockResolvedValue({ id: 100 }),
    findContactByUuid: jest.fn().mockResolvedValue({ id: 200 }),
    saveEventsLogs: jest.fn().mockResolvedValue({}),
  };
  const mockEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const mockCacheService = { get: jest.fn(), set: jest.fn() };
  const mockGeolocationService = { getLocation: jest.fn().mockResolvedValue({}) };
  const mockKafkaProvider = { sendAsyncMessage: jest.fn().mockResolvedValue(undefined) };

  const baseEvent = {
    apiKey: 'key-1',
    accountId: 1,
    uuid: 'uuid-1',
    email: 'test@test.com',
    contactId: 10,
    event: 'purchase',
    timestamp: Date.now(),
    properties: { amount: 100 },
  };

  const makeRequest = (events: any[]) => ({
    platform: PlatformType.CUSTOMEVENTS,
    payload: events,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomEventsService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CacheService, useValue: mockCacheService },
        { provide: GeolocationService, useValue: mockGeolocationService },
        { provide: KafkaProvider, useValue: mockKafkaProvider },
      ],
    }).compile();

    service = module.get<CustomEventsService>(CustomEventsService);
  });

  describe('customEventsProcess', () => {
    it('should call checkPostgresConnection', async () => {
      await service.customEventsProcess(makeRequest([baseEvent]) as any);
      expect(mockMsgopsService.checkPostgresConnection).toHaveBeenCalled();
    });

    it('should return early when payload is null', async () => {
      await service.customEventsProcess({ platform: PlatformType.CUSTOMEVENTS, payload: null } as any);
      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid custom events'));
    });

    it('should return early when payload is not an array', async () => {
      await service.customEventsProcess({ platform: PlatformType.CUSTOMEVENTS, payload: 'not-array' } as any);
      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid custom events'));
    });

    describe('event validation', () => {
      it('should skip event when apiKey and accountId are both missing', async () => {
        await service.customEventsProcess(
          makeRequest([{ ...baseEvent, apiKey: undefined, accountId: undefined }]) as any,
        );
        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(
          expect.stringContaining('Api key or account id is empty'),
        );
      });

      it('should skip event when uuid, email, and contactId are all missing', async () => {
        await service.customEventsProcess(
          makeRequest([{ ...baseEvent, uuid: undefined, email: undefined, contactId: undefined }]) as any,
        );
        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(
          expect.stringContaining('Uuid or email or contactId is empty'),
        );
      });

      it('should skip event when uuid is longer than 40 characters', async () => {
        await service.customEventsProcess(makeRequest([{ ...baseEvent, uuid: 'a'.repeat(41) }]) as any);
        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid uuid'));
      });

      it('should resolve accountId via apiKey when accountId is not provided', async () => {
        mockMsgopsService.findAccountIdByApiKey.mockResolvedValue(42);
        await service.customEventsProcess(
          makeRequest([{ ...baseEvent, accountId: undefined, apiKey: 'valid-key' }]) as any,
        );
        expect(mockMsgopsService.findAccountIdByApiKey).toHaveBeenCalledWith('valid-key');
      });

      it('should skip event when apiKey is invalid', async () => {
        mockMsgopsService.findAccountIdByApiKey.mockResolvedValue(0);
        await service.customEventsProcess(
          makeRequest([{ ...baseEvent, accountId: undefined, apiKey: 'bad-key' }]) as any,
        );
        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Account is empty'));
      });

      it('should skip event when custom event definition not found', async () => {
        mockMsgopsService.findEvent.mockResolvedValueOnce(null);
        await service.customEventsProcess(makeRequest([baseEvent]) as any);
        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('No custom events to process'));
      });
    });

    describe('contact resolution', () => {
      it('should resolve contactId via email when contactId not provided', async () => {
        await service.customEventsProcess(
          makeRequest([{ ...baseEvent, contactId: undefined, email: 'user@test.com' }]) as any,
        );
        expect(mockMsgopsService.findContactByEmail).toHaveBeenCalledWith(1, 'user@test.com');
      });

      it('should resolve contactId via uuid when contactId and email not provided', async () => {
        mockMsgopsService.findContactByEmail.mockResolvedValueOnce(null);
        await service.customEventsProcess(
          makeRequest([{ ...baseEvent, contactId: undefined, email: '', uuid: 'uuid-resolve' }]) as any,
        );
        expect(mockMsgopsService.findContactByUuid).toHaveBeenCalledWith(1, 'uuid-resolve');
      });

      it('should skip event when contactId cannot be resolved', async () => {
        mockMsgopsService.findContactByEmail.mockResolvedValueOnce(null);
        mockMsgopsService.findContactByUuid.mockResolvedValueOnce(null);
        await service.customEventsProcess(
          makeRequest([{ ...baseEvent, contactId: undefined, email: '', uuid: 'no-match' }]) as any,
        );
        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Contact not found'));
      });
    });

    describe('properties cleanup', () => {
      it('should call cleanObject on event.properties', async () => {
        await service.customEventsProcess(makeRequest([baseEvent]) as any);
        expect(mockFormatterUtils.cleanObject).toHaveBeenCalledWith(baseEvent.properties);
      });
    });

    describe('URL processing', () => {
      it('should extract query params from URL into properties', async () => {
        await service.customEventsProcess(
          makeRequest([{ ...baseEvent, url: 'https://example.com/page?foo=bar' }]) as any,
        );
        expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              url: 'https://example.com/page',
            }),
          ]),
        );
      });

      it('should skip event when URL is invalid', async () => {
        await service.customEventsProcess(makeRequest([{ ...baseEvent, url: 'not-valid-url' }]) as any);
        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid url'));
      });
    });

    describe('timestamp handling', () => {
      it('should normalize timestamp when provided', async () => {
        await service.customEventsProcess(makeRequest([{ ...baseEvent, timestamp: 1700000000 }]) as any);
        expect(mockFormatterUtils.normalizeTimestamp).toHaveBeenCalled();
      });

      it('should use Date.now() when timestamp not provided', async () => {
        mockFormatterUtils.normalizeTimestamp.mockReturnValueOnce(undefined);
        await service.customEventsProcess(makeRequest([{ ...baseEvent, timestamp: undefined }]) as any);
        // Should still process without error
        expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalled();
      });
    });

    describe('statistics and persistence', () => {
      it('should call updateEventStatistics with CUSTOMEVENTS platform', async () => {
        const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');
        await service.customEventsProcess(makeRequest([baseEvent]) as any);
        expect(updateStatsSpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ platform: PlatformType.CUSTOMEVENTS }),
        );
      });

      it('should call eventsTrigger with custom_events key', async () => {
        const triggerSpy = jest.spyOn(service as any, 'eventsTrigger');
        await service.customEventsProcess(makeRequest([baseEvent]) as any);
        expect(triggerSpy).toHaveBeenCalledWith('custom_events', expect.any(Array));
      });

      it('should call sendKafkaMessage for processed events', async () => {
        await service.customEventsProcess(makeRequest([baseEvent]) as any);
        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalled();
      });

      it('should call saveEventsLogs for processed events', async () => {
        await service.customEventsProcess(makeRequest([baseEvent]) as any);
        expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalled();
      });

      it('should execute Redis pipeline', async () => {
        await service.customEventsProcess(makeRequest([baseEvent]) as any);
        expect(mockPipeline.exec).toHaveBeenCalled();
      });

      it('should return empty object on success', async () => {
        const result = await service.customEventsProcess(makeRequest([baseEvent]) as any);
        expect(result).toEqual({});
      });

      it('should log when no events pass validation', async () => {
        await service.customEventsProcess(
          makeRequest([{ ...baseEvent, apiKey: undefined, accountId: undefined }]) as any,
        );
        expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('No custom events to process'));
      });
    });

    // Hop 3 of the email click flow (pageview). An external service publishes
    // directly to the pubsub topic with the user's IP already embedded in
    // event.ip. These tests guard that bot classification reaches ClickHouse
    // via Kafka properties, so we can correlate engagement across hops.
    describe('bot signal stamping for pageview', () => {
      const pageviewEvent = {
        ...baseEvent,
        event: 'pageview',
        ip: '189.153.175.193',
        userAgent:
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36',
      };

      it('stamps residential traits clean for a real user pageview', async () => {
        mockGeolocationService.getLocation.mockResolvedValueOnce({
          country: 'MX',
          region: 'DIF',
          city: 'Mexico City',
          traits: {
            asn: 8151,
            asnOrg: 'Uninet S.A. de C.V.',
            isp: '',
            organization: '',
            userType: 'residential',
            connectionType: 'Cable/DSL',
            isAnycast: false,
          },
        });

        await service.customEventsProcess(makeRequest([pageviewEvent]) as any);

        expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalled();
        const [payload] = mockKafkaProvider.sendAsyncMessage.mock.lastCall!;
        expect(payload.event).toBe('pageview');
        expect(payload.properties).toMatchObject({
          is_bot: false,
          is_datacenter: false,
          bot_classification: null,
          asn: 8151,
          asn_org: 'Uninet S.A. de C.V.',
          user_type: 'residential',
        });
      });

      it('UA denylist flips a hosting pageview with curl UA to is_bot=true (script_ua)', async () => {
        mockGeolocationService.getLocation.mockResolvedValueOnce({
          country: 'US',
          traits: {
            asn: 16509,
            asnOrg: 'Amazon.com, Inc.',
            isp: '',
            organization: '',
            userType: 'hosting',
            connectionType: '',
            isAnycast: false,
          },
        });

        await service.customEventsProcess(makeRequest([{ ...pageviewEvent, userAgent: 'curl/8.4.0' }]) as any);

        const [payload] = mockKafkaProvider.sendAsyncMessage.mock.lastCall!;
        expect(payload.properties).toMatchObject({
          is_bot: true,
          is_datacenter: true,
          bot_classification: 'script_ua',
          asn: 16509,
        });
      });

      it('returns all-false bot signals when the event has no ip', async () => {
        const { ip: _ip, ...noIpEvent } = pageviewEvent;
        await service.customEventsProcess(makeRequest([noIpEvent]) as any);

        expect(mockGeolocationService.getLocation).not.toHaveBeenCalled();
        const [payload] = mockKafkaProvider.sendAsyncMessage.mock.lastCall!;
        expect(payload.properties).toMatchObject({
          is_bot: false,
          is_datacenter: false,
          bot_classification: null,
          asn: 0,
          asn_org: '',
          user_type: '',
        });
      });
    });
  });
});
