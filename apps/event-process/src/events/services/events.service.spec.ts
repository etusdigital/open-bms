import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventsService } from './events.service';
import { RedisService } from '../../providers/redis/redis.service';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MsgopsService } from '../../msgops/msgops.service';
import { EXCHANGES } from '@bms/messaging';
import { EventPublisherService } from '../../event-publisher.service';
import { CacheService } from '../../msgops/cache.service';
import { GeolocationService } from '../../utils/geolocation/geolocation.service';
import { KafkaProvider } from '../../providers/kafka.provider';
import { PlatformType } from '../interfaces/push.interfaces';

// Concrete subclass for testing protected methods
class TestableEventsService extends EventsService {
  public testAcquireLock(id: string) {
    return this.acquireLock(id);
  }
  public testReleaseLock(id: string, token: string) {
    return this.releaseLock(id, token);
  }
  public testIsMessageProcessed(id: string) {
    return this.isMessageProcessed(id);
  }
  public testMarkMessageAsProcessed(id: string) {
    return this.markMessageAsProcessed(id);
  }
  public testUserAgentFormatter(ua: string) {
    return this.userAgentFormatter(ua);
  }
  public testGetGeoIpInfo(ip: string) {
    return this.getGeoIpInfo(ip);
  }
  public testUpdateEventStatistics(pipeline: any, options: any) {
    return this.updateEventStatistics(pipeline, options);
  }
  public testHandleRedisResults(results: any) {
    return this.handleRedisResults(results);
  }
  public testCreateRedisKey(keyName: string, emails: string[], expireInHours: number) {
    return this.createRedisKey(keyName, emails, expireInHours);
  }
  public testDeleteRedisKey(keyName: string, emails: string[]) {
    return this.deleteRedisKey(keyName, emails);
  }
  public testEventsTrigger(key: any, events: any, accountId?: number) {
    return this.eventsTrigger(key, events, accountId);
  }
  public testSendKafkaMessage(events: any) {
    return this.sendKafkaMessage(events);
  }
}

describe('EventsService', () => {
  let service: TestableEventsService;

  const mockPipeline = {
    set: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    hincrby: jest.fn().mockReturnThis(),
    hset: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
  };

  const mockRedisClient = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    eval: jest.fn().mockResolvedValue(1),
    pipeline: jest.fn(() => mockPipeline),
  };

  const mockRedisService = {
    getOrThrow: jest.fn(() => mockRedisClient),
  };

  const mockFormatterUtils = {
    logInfo: jest.fn(),
    convertTimestampToTimezone: jest.fn(() => '2024-01-01'),
    parseEventType: jest.fn(),
  };

  const mockMsgopsService = {
    checkPostgresConnection: jest.fn(),
    findContactById: jest.fn(),
  };

  const mockEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockGeolocationService = {
    getLocation: jest.fn(),
  };

  const mockKafkaProvider = {
    sendAsyncMessage: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (EventsService as any).userAgentParser = null;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestableEventsService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CacheService, useValue: mockCacheService },
        { provide: GeolocationService, useValue: mockGeolocationService },
        { provide: KafkaProvider, useValue: mockKafkaProvider },
      ],
    }).compile();

    service = module.get<TestableEventsService>(TestableEventsService);
  });

  describe('processWithIdempotency', () => {
    it('should throw BadRequestException when messageId is empty string', async () => {
      await expect(service.processWithIdempotency('', jest.fn())).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when messageId is undefined', async () => {
      await expect(service.processWithIdempotency(undefined, jest.fn())).rejects.toThrow(BadRequestException);
    });

    it('should return skipped when message was already processed', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(1);
      const result = await service.processWithIdempotency('msg-1', jest.fn());
      expect(result).toEqual(expect.objectContaining({ status: 'skipped' }));
    });

    it('should return skipped when lock cannot be acquired', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(0); // not processed
      mockRedisClient.set.mockResolvedValueOnce(null); // lock failed
      const result = await service.processWithIdempotency('msg-2', jest.fn());
      expect(result).toEqual(expect.objectContaining({ status: 'skipped' }));
    });

    it('should return skipped when message is processed between lock and check', async () => {
      mockRedisClient.exists
        .mockResolvedValueOnce(0) // first check: not processed
        .mockResolvedValueOnce(1); // after lock: processed
      mockRedisClient.set.mockResolvedValueOnce('OK'); // lock acquired

      const result = await service.processWithIdempotency('msg-3', jest.fn());
      expect(result).toEqual(expect.objectContaining({ status: 'skipped' }));
    });

    it('should execute processor and mark message as processed on success', async () => {
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.set.mockResolvedValue('OK');

      const processor = jest.fn().mockResolvedValue({ data: 'result' });
      const result = await service.processWithIdempotency('msg-4', processor);

      expect(processor).toHaveBeenCalled();
      expect(result).toEqual({ data: 'result' });
      // markMessageAsProcessed (TTL covers AMQP retry budget)
      expect(mockRedisClient.set).toHaveBeenCalledWith('event-process:processed_message:msg-4', '1', 'EX', 3600);
    });

    it('should release lock in finally block even when processor throws', async () => {
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.set.mockResolvedValue('OK');

      const processor = jest.fn().mockRejectedValue(new Error('processing error'));
      await expect(service.processWithIdempotency('msg-5', processor)).rejects.toThrow('processing error');
      // releaseLock runs the compare-and-delete Lua script
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'event-process:processing_lock:msg-5',
        expect.any(String),
      );
    });
  });

  describe('acquireLock', () => {
    it('should return a token when Redis SET NX succeeds', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      const result = await service.testAcquireLock('test-id');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return null when Redis SET NX fails', async () => {
      mockRedisClient.set.mockResolvedValueOnce(null);
      const result = await service.testAcquireLock('test-id');
      expect(result).toBeNull();
    });

    it('should use correct key pattern, token value, and 60s TTL', async () => {
      await service.testAcquireLock('test-id');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'event-process:processing_lock:test-id',
        expect.any(String),
        'EX',
        60,
        'NX',
      );
    });
  });

  describe('releaseLock', () => {
    it('should run compare-and-delete Lua script with key and token', async () => {
      await service.testReleaseLock('test-id', 'token-abc');
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('GET'"),
        1,
        'event-process:processing_lock:test-id',
        'token-abc',
      );
    });
  });

  describe('isMessageProcessed', () => {
    it('should return true when Redis EXISTS returns 1', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(1);
      const result = await service.testIsMessageProcessed('test-id');
      expect(result).toBe(true);
    });

    it('should return false when Redis EXISTS returns 0', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(0);
      const result = await service.testIsMessageProcessed('test-id');
      expect(result).toBe(false);
    });
  });

  describe('markMessageAsProcessed', () => {
    it('should call Redis SET with 1-hour TTL (covers AMQP retry budget)', async () => {
      await service.testMarkMessageAsProcessed('test-id');
      expect(mockRedisClient.set).toHaveBeenCalledWith('event-process:processed_message:test-id', '1', 'EX', 3600);
    });
  });

  describe('userAgentFormatter', () => {
    it('should return cached result when UA was already parsed', () => {
      const cached = { is_mobile: true, user_agent: 'test', os: 'iOS', os_version: '16', browser: 'Safari' };
      mockCacheService.get.mockReturnValueOnce(cached);

      const result = service.testUserAgentFormatter('test');
      expect(result).toBe(cached);
    });

    it('should parse desktop UA string', () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      const result = service.testUserAgentFormatter(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
      );
      expect(result.is_mobile).toBe(false);
      expect(result.os).toBe('Windows');
      expect(result.browser).toBe('Chrome');
    });

    it('should parse mobile UA string', () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      const result = service.testUserAgentFormatter(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      );
      expect(result.is_mobile).toBe(true);
      expect(result.os).toBe('iOS');
    });

    it('should set result in cache after parsing', () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      service.testUserAgentFormatter('some-agent');
      expect(mockCacheService.set).toHaveBeenCalledWith('userAgent', 'some-agent', expect.any(Object));
    });
  });

  describe('getGeoIpInfo', () => {
    it('should return empty object when ip is empty', async () => {
      const result = await service.testGetGeoIpInfo('');
      expect(result).toEqual({});
    });

    it('should return empty object when ip is undefined', async () => {
      const result = await service.testGetGeoIpInfo(undefined);
      expect(result).toEqual({});
    });

    it('should return location data from geolocationService', async () => {
      mockGeolocationService.getLocation.mockResolvedValueOnce({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
      });

      const result = await service.testGetGeoIpInfo('1.2.3.4');
      expect(result).toEqual({ country: 'US', region: 'CA', city: 'San Francisco', traits: undefined });
    });

    it('should pass traits through from the geolocation service', async () => {
      mockGeolocationService.getLocation.mockResolvedValueOnce({
        country: 'US',
        region: 'CA',
        city: 'Mountain View',
        traits: {
          asn: 15169,
          asnOrg: 'Google LLC',
          isp: 'Google LLC',
          organization: 'Level 3',
          userType: 'hosting',
          connectionType: 'Corporate',
          isAnycast: true,
        },
      });

      const result = await service.testGetGeoIpInfo('74.125.1.1');
      expect(result.traits).toEqual(expect.objectContaining({ asn: 15169, userType: 'hosting', asnOrg: 'Google LLC' }));
    });

    it('should return empty object and log when geolocationService throws', async () => {
      mockGeolocationService.getLocation.mockRejectedValueOnce(new Error('gRPC fail'));

      const result = await service.testGetGeoIpInfo('1.2.3.4');
      expect(result).toEqual({});
      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Error getting GeoIP'));
    });
  });

  describe('handleRedisResults', () => {
    it('should log errors from pipeline results', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      service.testHandleRedisResults([
        [new Error('redis err'), null],
        [null, 'OK'],
      ]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error in Redis'), expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('updateEventStatistics', () => {
    const baseOptions = {
      accountId: 1,
      messageId: 100,
      eventId: 50,
      event: 'delivered',
      contactId: 10,
      platform: PlatformType.EMAIL,
      type: 'campaign' as const,
      timeZone: 'UTC',
      timestamp: 1700000000,
    };

    it('should call pipeline.hincrby for event count', () => {
      service.testUpdateEventStatistics(mockPipeline, baseOptions);
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining('statistics:'), 'delivered', 1);
    });

    it('should call pipeline.hincrby for hourly count', () => {
      service.testUpdateEventStatistics(mockPipeline, baseOptions);
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringContaining('statistics:'),
        expect.stringContaining('hourly_delivered:'),
        1,
      );
    });

    it('should call pipeline.sadd for daily processed messages for non-CUSTOMEVENTS', () => {
      service.testUpdateEventStatistics(mockPipeline, baseOptions);
      expect(mockPipeline.sadd).toHaveBeenCalledWith(
        expect.stringContaining('statistics_processed_messages:'),
        expect.any(String),
      );
    });

    it('should use "count" as event name for CUSTOMEVENTS', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        platform: PlatformType.CUSTOMEVENTS,
      });
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining('statistics:'), 'count', 1);
    });

    it('should set utm_campaign when provided', () => {
      service.testUpdateEventStatistics(mockPipeline, { ...baseOptions, utmCampaign: 'test-campaign' });
      expect(mockPipeline.hset).toHaveBeenCalledWith(
        expect.stringContaining('statistics:'),
        'utm_campaign',
        'test-campaign',
      );
    });

    it('should set pool for EMAIL platform', () => {
      service.testUpdateEventStatistics(mockPipeline, { ...baseOptions, pool: 'pool-1' });
      expect(mockPipeline.hset).toHaveBeenCalledWith(expect.stringContaining('statistics:'), 'pool', 'pool-1');
    });

    it('should track click_position when linkPosition is provided', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'click',
        linkPosition: 3,
      });
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining('statistics:'), 'click_position_3', 1);
    });

    it('should track email provider for EMAIL platform', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        emailProvider: 'Gmail',
      });
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringContaining('statistics:'),
        'email_provider_delivered_Gmail',
        1,
      );
    });

    it('should track unique contacts for open events', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'open',
        userAgent: 'Mozilla/5.0 Chrome/120',
      });
      expect(mockPipeline.sadd).toHaveBeenCalledWith(expect.stringContaining('statistics_unique:'), 10);
    });

    it('should track browser/OS breakdown when userAgent provided for click events', () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'click',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
      });
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringContaining('statistics:'),
        expect.stringMatching(/^browser_click_/),
        1,
      );
    });

    it('should track geo data when provided for open events', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'open',
        geoData: { country: 'US', region: 'CA', city: 'SF' },
      });
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining('statistics:'), 'country_open_US', 1);
    });

    it('should track global account statistics', () => {
      service.testUpdateEventStatistics(mockPipeline, baseOptions);
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringContaining('account_events_statistics:'),
        'delivered',
        1,
      );
    });

    it('should track unique contacts in global stats for relevant events', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'open',
      });
      expect(mockPipeline.sadd).toHaveBeenCalledWith(expect.stringContaining('account_events_unique:'), 10);
    });

    it('should track open timing buckets for open events with sent_at', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'open',
        sent_at: String((baseOptions.timestamp - 3) * 1000), // 3 seconds ago
        timestamp: baseOptions.timestamp,
      });
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringContaining('statistics:'),
        'open_under_5_seconds',
        1,
      );
    });

    it('should set providerAccount when provided', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        providerAccount: 'sg-account-1',
      });
      expect(mockPipeline.hset).toHaveBeenCalledWith(
        expect.stringContaining('statistics:'),
        'provider_account',
        'sg-account-1',
      );
    });

    it('should track custom events daily list and last_occurrence', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        platform: PlatformType.CUSTOMEVENTS,
      });
      expect(mockPipeline.sadd).toHaveBeenCalledWith(
        expect.stringContaining('statistics_processed_custom_events:'),
        expect.any(String),
      );
    });
  });

  describe('createRedisKey', () => {
    it('should set Redis key for each email with correct TTL', async () => {
      await service.testCreateRedisKey('prefix', ['a@test.com', 'b@test.com'], 24);
      expect(mockPipeline.set).toHaveBeenCalledWith('prefix:a@test.com', 'true', 'EX', 86400);
      expect(mockPipeline.set).toHaveBeenCalledWith('prefix:b@test.com', 'true', 'EX', 86400);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('deleteRedisKey', () => {
    it('should delete Redis keys for each email', async () => {
      await service.testDeleteRedisKey('prefix', ['a@test.com']);
      expect(mockPipeline.del).toHaveBeenCalledWith('prefix:a@test.com');
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('eventsTrigger', () => {
    it('should return early when eventPublisher is null', async () => {
      (service as any).eventPublisher = null;
      await service.testEventsTrigger('open', []);
      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('EventPublisher not available'));
    });

    it('should check Redis for trigger keys and publish AMQP message', async () => {
      mockRedisClient.exists.mockResolvedValue(1);
      mockFormatterUtils.parseEventType.mockReturnValue('100');

      const events = [{ contactId: 5, category: ['message_100'] }];
      await service.testEventsTrigger('open', events, 1);

      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('should handle custom_events key with uuid', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const events = [{ uuid: 'test-uuid', eventId: 42, contactId: 5, accountId: 1 }];
      await service.testEventsTrigger('custom_events', events);

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        EXCHANGES.tags,
        'tag.process',
        expect.objectContaining({ event: 'custom_events', uuid: 'test-uuid' }),
        expect.any(Object),
      );
    });
  });

  describe('processActivationEvents', () => {
    it('should publish BMS message via AMQP', async () => {
      await service.processActivationEvents([
        { accountId: '1', timestamp: 1234, contactId: 5, event: 'activated' } as any,
      ]);
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });
  });

  describe('updateEventStatistics click counters', () => {
    const baseOptions = {
      accountId: 288,
      eventId: 0,
      contactId: 1,
      platform: PlatformType.EMAIL,
      type: 'campaign' as const,
      timeZone: 'UTC',
      timestamp: 1700000000,
      messageId: 42,
    };

    const gmailGeoData = {
      country: 'US',
      traits: {
        asn: 15169,
        asnOrg: 'Google LLC',
        isp: '',
        organization: '',
        userType: 'hosting',
        connectionType: '',
        isAnycast: false,
      },
    };

    const gcpGeoData = {
      country: 'US',
      traits: {
        asn: 396982,
        asnOrg: 'Google LLC',
        isp: '',
        organization: '',
        userType: 'hosting',
        connectionType: '',
        isAnycast: false,
      },
    };

    const residentialGeoData = {
      country: 'BR',
      traits: {
        asn: 28573,
        asnOrg: 'Claro',
        isp: '',
        organization: '',
        userType: 'residential',
        connectionType: '',
        isAnycast: false,
      },
    };

    beforeEach(() => mockPipeline.hincrby.mockClear());

    it('increments bot_click AND datacenter_click for a Gmail click', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'click',
        geoData: gmailGeoData,
      });
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringMatching(/^statistics:288:/), 'bot_click', 1);
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringMatching(/^account_events_statistics:288:/),
        'bot_click',
        1,
      );
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringMatching(/^statistics:288:/),
        'datacenter_click',
        1,
      );
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringMatching(/^account_events_statistics:288:/),
        'datacenter_click',
        1,
      );
    });

    it('increments datacenter_click but NOT bot_click for a GCP click', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'click',
        geoData: gcpGeoData,
      });
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringMatching(/^statistics:288:/),
        'datacenter_click',
        1,
      );
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'bot_click', 1);
    });

    it('does NOT increment either counter for a residential click', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'click',
        geoData: residentialGeoData,
      });
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'bot_click', 1);
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'datacenter_click', 1);
    });

    it('does NOT increment bot_open or datacenter_open on open events — opens are not aggregated', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'open',
        geoData: gmailGeoData,
      });
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'bot_open', 1);
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'datacenter_open', 1);
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'bot_click', 1);
    });

    it('does NOT increment for non-click events even with bot traits', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'delivered',
        geoData: gmailGeoData,
      });
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'bot_click', 1);
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'datacenter_click', 1);
    });

    it('does NOT increment when geoData.traits is missing', () => {
      service.testUpdateEventStatistics(mockPipeline, { ...baseOptions, event: 'click' });
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'bot_click', 1);
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'datacenter_click', 1);
    });

    it('UA denylist upgrades a GCP click to bot_click when UA is "Shop Service"', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'click',
        geoData: gcpGeoData,
        userAgent: 'Shop Service',
      });
      // Both counters fire: bot_click (narrow, via UA denylist) and datacenter_click (wide).
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringMatching(/^statistics:288:/), 'bot_click', 1);
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringMatching(/^statistics:288:/),
        'datacenter_click',
        1,
      );
    });

    it('UA denylist does NOT upgrade a residential click even with curl UA', () => {
      service.testUpdateEventStatistics(mockPipeline, {
        ...baseOptions,
        event: 'click',
        geoData: residentialGeoData,
        userAgent: 'curl/8.4.0',
      });
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'bot_click', 1);
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.any(String), 'datacenter_click', 1);
    });
  });

  describe('sendKafkaMessage', () => {
    it('should send each event to Kafka', async () => {
      await service.testSendKafkaMessage([{ accountId: 1, event: 'test' }]);
      expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalled();
    });

    const gmailTraits = {
      asn: 15169,
      asnOrg: 'Google LLC',
      isp: 'Google LLC',
      organization: 'Level 3',
      userType: 'hosting',
      connectionType: 'Corporate',
      isAnycast: true,
    };

    const gcpTraits = { ...gmailTraits, asn: 396982 };

    it('stamps full bot signals for a Gmail click (narrow is_bot + is_datacenter)', async () => {
      await service.testSendKafkaMessage([{ accountId: 1, event: 'click', traits: gmailTraits }]);
      expect(mockKafkaProvider.sendAsyncMessage).toHaveBeenCalled();
      const [payload] = mockKafkaProvider.sendAsyncMessage.mock.lastCall!;
      expect(payload.properties).toMatchObject({
        is_bot: true,
        is_datacenter: true,
        bot_classification: 'gmail_prefetch',
        asn: 15169,
        asn_org: 'Google LLC',
        user_type: 'hosting',
      });
    });

    it('stamps is_datacenter=true but is_bot=false for a GCP click (Shop app etc.)', async () => {
      await service.testSendKafkaMessage([{ accountId: 1, event: 'click', traits: gcpTraits }]);
      const [payload] = mockKafkaProvider.sendAsyncMessage.mock.lastCall!;
      expect(payload.properties).toMatchObject({
        is_bot: false,
        is_datacenter: true,
        bot_classification: 'datacenter',
        asn: 396982,
      });
    });

    it('stamps all-false / zero defaults when traits are missing', async () => {
      await service.testSendKafkaMessage([{ accountId: 1, event: 'click' }]);
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

    it('preserves existing properties when merging bot fields', async () => {
      await service.testSendKafkaMessage([
        {
          accountId: 1,
          event: 'bounce',
          traits: gmailTraits,
          properties: { bounce_classification: 'Reputation' },
        },
      ]);
      const [payload] = mockKafkaProvider.sendAsyncMessage.mock.lastCall!;
      expect(payload.properties).toMatchObject({
        bounce_classification: 'Reputation',
        is_bot: true,
        is_datacenter: true,
        bot_classification: 'gmail_prefetch',
      });
    });

    it('UA denylist on a GCP click flips is_bot=true with script_ua classification', async () => {
      await service.testSendKafkaMessage([
        { accountId: 1, event: 'click', traits: gcpTraits, userAgent: 'Shop Service' },
      ]);
      const [payload] = mockKafkaProvider.sendAsyncMessage.mock.lastCall!;
      expect(payload.properties).toMatchObject({
        is_bot: true,
        is_datacenter: true,
        bot_classification: 'script_ua',
        asn: 396982,
      });
    });

    it('reads snake_case user_agent when camelCase userAgent is absent', async () => {
      await service.testSendKafkaMessage([
        { accountId: 1, event: 'click', traits: gcpTraits, user_agent: 'curl/8.4.0' },
      ]);
      const [payload] = mockKafkaProvider.sendAsyncMessage.mock.lastCall!;
      expect(payload.properties.is_bot).toBe(true);
      expect(payload.properties.bot_classification).toBe('script_ua');
    });

    it('strips top-level traits from the Kafka payload (no column in ClickHouse)', async () => {
      await service.testSendKafkaMessage([{ accountId: 1, event: 'click', traits: gmailTraits }]);
      const [payload] = mockKafkaProvider.sendAsyncMessage.mock.lastCall!;
      expect(payload).not.toHaveProperty('traits');
    });
  });
});
