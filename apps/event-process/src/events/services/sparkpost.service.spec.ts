import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../providers/redis/redis.service';
import { SparkpostService } from './sparkpost.service';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MsgopsService } from '../../msgops/msgops.service';
import { EventPublisherService } from '../../event-publisher.service';
import { CacheService } from '../../msgops/cache.service';
import { GEO_PROVIDER_TOKEN } from '@bms/geo';
import { AnalyticsPublisherProvider } from '../../providers/analytics-publisher.provider';
import { SparkPostBounceClass, SparkPostEnvelope, SparkPostEventTypes } from '../interfaces/events.interfaces';

const ACCOUNT_ID = '42';
const TIMESTAMP = 1700000000;

function makeRcptMeta(overrides: Record<string, string | number> = {}): Record<string, string | number> {
  const defaults = { account: ACCOUNT_ID, message: '1', type: 'campaign', campaign: '99' };
  return { ...defaults, ...overrides };
}

function makeMessageEvent(type: string, overrides: Partial<any> = {}): SparkPostEnvelope {
  return {
    msys: {
      message_event: {
        type,
        event_id: `evt-${Math.random()}`,
        timestamp: TIMESTAMP,
        rcpt_to: 'test@example.com',
        rcpt_meta: makeRcptMeta(),
        message_id: 'msg-1',
        ...overrides,
      },
    },
  };
}

function makeBounceEnvelope(overrides: Partial<any> = {}): SparkPostEnvelope {
  return makeMessageEvent(SparkPostEventTypes.BOUNCE, {
    bounce_class: SparkPostBounceClass.INVALID_RECIPIENT,
    reason: '550 user unknown',
    rcpt_meta: makeRcptMeta({ contactId: '123' }),
    ...overrides,
  });
}

function makeTrackEvent(type: string, overrides: Partial<any> = {}): SparkPostEnvelope {
  return {
    msys: {
      track_event: {
        type,
        event_id: `trk-${Math.random()}`,
        timestamp: TIMESTAMP,
        rcpt_to: 'user@example.com',
        rcpt_meta: makeRcptMeta({ contactId: '10' }),
        message_id: 'msg-1',
        ip_address: '1.2.3.4',
        user_agent: 'Mozilla/5.0 Chrome/120',
        ...overrides,
      },
    },
  };
}

function makeUnsubscribeEnvelope(type: string, overrides: Partial<any> = {}): SparkPostEnvelope {
  return {
    msys: {
      unsubscribe_event: {
        type,
        event_id: `uns-${Math.random()}`,
        timestamp: TIMESTAMP,
        rcpt_to: 'user@example.com',
        rcpt_meta: makeRcptMeta({ contactId: '55' }),
        message_id: 'msg-1',
        ...overrides,
      },
    },
  };
}

describe('SparkpostService', () => {
  let service: SparkpostService;

  const mockPipeline = {
    set: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, 'OK']]),
    hincrby: jest.fn().mockReturnThis(),
    hset: jest.fn().mockReturnThis(),
    zadd: jest.fn().mockReturnThis(),
    zincrby: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
  };

  const mockRedisClient = {
    pipeline: jest.fn(() => mockPipeline),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
  };

  const mockRedisService = {
    getOrThrow: jest.fn(() => mockRedisClient),
  };

  const mockMsgopsService = {
    checkPostgresConnection: jest.fn().mockResolvedValue(undefined),
    getAccountTimeZone: jest.fn().mockResolvedValue('America/Sao_Paulo'),
    updateContactsById: jest.fn().mockResolvedValue({}),
    updateContactsValidateByEmail: jest.fn().mockResolvedValue({}),
    batchUpdateContactsBounce: jest.fn().mockResolvedValue({}),
    batchUpsertValidationBounce: jest.fn().mockResolvedValue({}),
    clearValidationUnsubscribed: jest.fn().mockResolvedValue({}),
    saveEventsLogs: jest.fn().mockResolvedValue({}),
    findContactById: jest.fn().mockResolvedValue(null),
  };

  const mockFormatterUtils = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    parseEventType: jest.fn((categories: string[], key: string) => {
      if (!categories) return null;
      const entry = categories.find((c) => c.startsWith(`${key}:`));
      return entry ? entry.split(':')[1] : null;
    }),
    normalizeEvents: jest.fn((e) => e),
    convertTimestampToTimezone: jest.fn(() => '2024-01-01'),
    removeQueryStringFromUrl: jest.fn((url) => url),
    getMailBoxProvider: jest.fn(() => 'gmail'),
    sendSlackWebhook: jest.fn().mockResolvedValue(undefined),
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
    mockPipeline.exec.mockResolvedValue(Array(50).fill([null, 'OK']));
    mockRedisClient.exists.mockResolvedValue(0);
    mockFormatterUtils.parseEventType.mockImplementation((categories: string[], key: string) => {
      if (!categories) return null;
      const entry = categories.find((c: string) => c.startsWith(`${key}:`));
      return entry ? entry.split(':')[1] : null;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SparkpostService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CacheService, useValue: mockCacheService },
        { provide: GEO_PROVIDER_TOKEN, useValue: mockGeolocationService },
        { provide: AnalyticsPublisherProvider, useValue: mockAnalyticsPublisherProvider },
      ],
    }).compile();

    service = module.get<SparkpostService>(SparkpostService);
  });

  // ─────────────────────────────────────────────────────────────
  // Envelope unwrapping & event mapping
  // ─────────────────────────────────────────────────────────────
  describe('envelope unwrapping & event mapping', () => {
    it('unwraps message_event delivery envelope', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.DELIVERY, {
        rcpt_meta: makeRcptMeta({ contactId: '10' }),
      });
      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ lastSent: expect.any(Date) }),
      );
    });

    it('unwraps track_event open envelope', async () => {
      const env = makeTrackEvent(SparkPostEventTypes.OPEN);
      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isActive: true }),
      );
    });

    it('unwraps unsubscribe_event envelope', async () => {
      const env = makeUnsubscribeEnvelope(SparkPostEventTypes.LIST_UNSUBSCRIBE);
      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isUnsubscribed: true }),
      );
    });

    it('skips unknown event types and logs', async () => {
      const env = makeMessageEvent('completely_unknown_type');
      const result = await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(result).toEqual(expect.objectContaining({ status: 'skipped' }));
      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(
        expect.stringContaining('Skipping unsupported event type'),
      );
    });

    it('silently drops relay_* events without logging (avoids log spam)', async () => {
      const env = makeMessageEvent('relay_message');
      const result = await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(result).toEqual(expect.objectContaining({ status: 'skipped' }));
      expect(mockFormatterUtils.logInfo).not.toHaveBeenCalledWith(
        expect.stringContaining('Skipping unsupported event type'),
      );
    });

    it('maps initial_open as open', async () => {
      const env = makeTrackEvent(SparkPostEventTypes.INITIAL_OPEN);
      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isActive: true }),
      );
    });

    it('maps amp_click as click', async () => {
      const env = makeTrackEvent(SparkPostEventTypes.AMP_CLICK, { target_link_url: 'https://example.com/x' });
      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isActive: true }),
      );
    });

    it('maps out_of_band as bounce', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.OUT_OF_BAND, {
        bounce_class: SparkPostBounceClass.INVALID_RECIPIENT,
        rcpt_meta: makeRcptMeta({ contactId: '70' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 70, bounceType: 'HARD' })]),
        Number(ACCOUNT_ID),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Bounce contact updates
  // ─────────────────────────────────────────────────────────────
  describe('bounce contact updates', () => {
    it('marks contact as HARD bounce for invalid recipient class', async () => {
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.INVALID_RECIPIENT,
        rcpt_meta: makeRcptMeta({ contactId: '10' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 10, bounceType: 'HARD' })]),
        Number(ACCOUNT_ID),
      );
    });

    it('marks contact as SOFT bounce for mailbox full class', async () => {
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.MAILBOX_FULL,
        rcpt_meta: makeRcptMeta({ contactId: '20' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 20, bounceType: 'SOFT' })]),
        Number(ACCOUNT_ID),
      );
    });

    it('does NOT call batchUpdateContactsBounce for sender-issue Reputation class', async () => {
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.SPAM_BLOCK,
        reason: '550 Gmail spam',
        rcpt_meta: makeRcptMeta({ contactId: '999' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).not.toHaveBeenCalled();
    });

    it('does NOT call batchUpdateContactsBounce for sender-issue Technical class', async () => {
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.DNS_FAILURE,
        reason: 'DNS lookup failed',
        rcpt_meta: makeRcptMeta({ contactId: '999' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).not.toHaveBeenCalled();
    });

    it('splits a mixed batch: HARD and SOFT in two separate batch calls', async () => {
      const hardEvent = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.INVALID_RECIPIENT,
        rcpt_meta: makeRcptMeta({ contactId: '100' }),
        rcpt_to: 'hard@example.com',
        event_id: 'hard-1',
      });
      const softEvent = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.MAILBOX_FULL,
        rcpt_meta: makeRcptMeta({ contactId: '200' }),
        rcpt_to: 'soft@example.com',
        event_id: 'soft-1',
      });

      await service.processSparkPost({
        payload: [hardEvent, softEvent],
        platform: 'sparkpost' as any,
        account: 'acct1',
      });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 100, bounceType: 'HARD' })]),
        Number(ACCOUNT_ID),
      );
      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 200, bounceType: 'SOFT' })]),
        Number(ACCOUNT_ID),
      );
      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledTimes(2);
    });

    it('hard bounce wins when same contact appears in both hard and soft groups', async () => {
      const SHARED_CONTACT = '42';

      const hardEvent = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.INVALID_RECIPIENT,
        rcpt_meta: makeRcptMeta({ contactId: SHARED_CONTACT }),
        rcpt_to: 'shared@example.com',
        event_id: 'hard-shared',
      });
      const softEvent = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.MAILBOX_FULL,
        rcpt_meta: makeRcptMeta({ contactId: SHARED_CONTACT }),
        rcpt_to: 'shared@example.com',
        event_id: 'soft-shared',
      });

      await service.processSparkPost({
        payload: [hardEvent, softEvent],
        platform: 'sparkpost' as any,
        account: 'acct1',
      });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 42, bounceType: 'HARD' })]),
        Number(ACCOUNT_ID),
      );

      const softCall = mockMsgopsService.batchUpdateContactsBounce.mock.calls.find(([entries]) =>
        entries.some((e: any) => e.bounceType === 'SOFT'),
      );
      if (softCall) {
        expect(softCall[0]).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 42 })]));
      }
    });

    it('issues exactly two SQL statements regardless of batch size', async () => {
      const events = [1, 2, 3, 4, 5].map((n) =>
        makeBounceEnvelope({
          rcpt_meta: makeRcptMeta({ contactId: String(n) }),
          rcpt_to: `c${n}@example.com`,
          event_id: `e${n}`,
        }),
      );

      await service.processSparkPost({ payload: events, platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledTimes(1);
      expect(mockMsgopsService.batchUpsertValidationBounce).toHaveBeenCalledTimes(1);
    });

    it('falls back to reason matcher when bounce_class is missing', async () => {
      const env = makeBounceEnvelope({
        bounce_class: undefined,
        reason: '550 User unknown',
        rcpt_meta: makeRcptMeta({ contactId: '11' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 11, bounceType: 'HARD' })]),
        Number(ACCOUNT_ID),
      );
    });

    it('returns false when reason and bounce_class are both empty', async () => {
      const env = makeBounceEnvelope({
        bounce_class: undefined,
        reason: '',
        rcpt_meta: makeRcptMeta({ contactId: '12' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).not.toHaveBeenCalled();
    });

    it('remaps bounce_class=90 (Unsubscribe ARF) to unsubscribe handling', async () => {
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.UNSUBSCRIBE,
        rcpt_meta: makeRcptMeta({ contactId: '90' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isUnsubscribed: true }),
      );
      expect(mockMsgopsService.batchUpdateContactsBounce).not.toHaveBeenCalled();
    });

    it('drops bounce_class=80 (Subscribe ARF) entirely — no contact updates, no log', async () => {
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.SUBSCRIBE,
        rcpt_meta: makeRcptMeta({ contactId: '80' }),
      });

      const result = await service.processSparkPost({
        payload: [env],
        platform: 'sparkpost' as any,
        account: 'acct1',
      });

      expect(result).toEqual(expect.objectContaining({ status: 'skipped' }));
      expect(mockMsgopsService.updateContactsById).not.toHaveBeenCalled();
      expect(mockMsgopsService.batchUpdateContactsBounce).not.toHaveBeenCalled();
      expect(mockMsgopsService.saveEventsLogs).not.toHaveBeenCalled();
    });

    it('treats bounce_class=100 (Challenge-Response) as HARD recipient bounce', async () => {
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.CHALLENGE_RESPONSE,
        rcpt_meta: makeRcptMeta({ contactId: '101' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 101, bounceType: 'HARD' })]),
        Number(ACCOUNT_ID),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // A/B test counters
  // ─────────────────────────────────────────────────────────────
  describe('A/B test event counters', () => {
    function makeTestAbBounceEnvelope(overrides: Partial<any> = {}): SparkPostEnvelope {
      return makeBounceEnvelope({
        rcpt_meta: makeRcptMeta({ contactId: '123', 'testab-message': '1' }),
        ...overrides,
      });
    }

    beforeEach(() => {
      mockRedisClient.exists.mockResolvedValue(1);
    });

    it('increments "bounce" counter for recipient-issue bounce in A/B test', async () => {
      const env = makeTestAbBounceEnvelope({
        bounce_class: SparkPostBounceClass.INVALID_RECIPIENT,
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining('testab:campaign:'), 'bounce', 1);
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.stringContaining('testab:campaign:'), 'blocked', 1);
    });

    it('increments "blocked" counter (not "bounce") for sender-issue bounce in A/B test', async () => {
      const env = makeTestAbBounceEnvelope({
        bounce_class: SparkPostBounceClass.SPAM_BLOCK,
        reason: '550 Gmail spam policy',
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining('testab:campaign:'), 'blocked', 1);
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.stringContaining('testab:campaign:'), 'bounce', 1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Statistics: sender-issue bounces tracked as 'blocked'
  // ─────────────────────────────────────────────────────────────
  describe('event statistics for bounce events', () => {
    it('tracks sender-issue bounce as "blocked" in statistics, not "bounce"', async () => {
      const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.SPAM_BLOCK,
        reason: '550 Gmail spam policy',
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(updateStatsSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ event: 'blocked' }));
      expect(updateStatsSpy).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ event: 'bounce' }));
    });

    it('tracks recipient-issue bounce as "bounce" in statistics', async () => {
      const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.INVALID_RECIPIENT,
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(updateStatsSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ event: 'bounce' }));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Bounce log properties
  // ─────────────────────────────────────────────────────────────
  describe('bounce event log properties', () => {
    it('saves bounce_classification + bounce_class in event log properties', async () => {
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.SPAM_BLOCK,
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({
              bounce_class: SparkPostBounceClass.SPAM_BLOCK,
              bounce_classification: `class_${SparkPostBounceClass.SPAM_BLOCK}`,
            }),
          }),
        ]),
      );
    });

    it('saves bounce_type=HARD for invalid recipient class', async () => {
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.INVALID_RECIPIENT,
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ bounce_type: 'HARD' }),
          }),
        ]),
      );
    });

    it('saves bounce_type=SOFT for mailbox full class', async () => {
      const env = makeBounceEnvelope({
        bounce_class: SparkPostBounceClass.MAILBOX_FULL,
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ bounce_type: 'SOFT' }),
          }),
        ]),
      );
    });

    it('saves reason at top-level of event log (not inside properties)', async () => {
      const env = makeBounceEnvelope({
        reason: '550 User unknown',
        bounce_class: SparkPostBounceClass.INVALID_RECIPIENT,
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            reason: '550 User unknown',
            properties: expect.not.objectContaining({ reason: expect.anything() }),
          }),
        ]),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Duplicate filtering
  // ─────────────────────────────────────────────────────────────
  describe('duplicate event filtering', () => {
    it('returns skipped status when all events are duplicates', async () => {
      mockPipeline.exec.mockResolvedValueOnce([[null, null]]); // NX returns null = duplicate
      const env = makeMessageEvent(SparkPostEventTypes.DELIVERY, { event_id: 'dup-1' });

      const result = await service.processSparkPost({
        payload: [env],
        platform: 'sparkpost' as any,
        account: 'acct1',
      });

      expect(result).toEqual(expect.objectContaining({ status: 'skipped' }));
    });

    it('uses event:sparkpost: prefix for dedup keys', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.DELIVERY, { event_id: 'unique-evt-1' });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockPipeline.set).toHaveBeenCalledWith('event:sparkpost:unique-evt-1', '1', 'EX', 10 * 60, 'NX');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Open/click event processing
  // ─────────────────────────────────────────────────────────────
  describe('open/click event processing', () => {
    it('builds activation event when contact last_open is null', async () => {
      mockMsgopsService.findContactById.mockResolvedValueOnce({
        id: 10,
        last_open: null,
        last_click: null,
        uuid: 'u1',
        email: 'user@example.com',
        ip: '1.2.3.4',
      });

      const env = makeTrackEvent(SparkPostEventTypes.OPEN);
      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('fetches geoIP for open events with IP', async () => {
      mockGeolocationService.lookup.mockResolvedValueOnce({ country: 'BR', region: 'SP', city: 'SP' });
      const env = makeTrackEvent(SparkPostEventTypes.OPEN, { ip_address: '8.8.8.8' });
      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockGeolocationService.lookup).toHaveBeenCalledWith('8.8.8.8');
    });

    it('checks automation target Redis key for open/click events', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const env = makeTrackEvent(SparkPostEventTypes.OPEN, {
        rcpt_meta: makeRcptMeta({ contactId: '10', 'automation-id': '77' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Account suspension Slack alert
  // ─────────────────────────────────────────────────────────────
  describe('account suspension alerts', () => {
    it('sends Slack webhook when burst of policy_rejection signals subaccount suspension', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.POLICY_REJECTION, {
        reason: 'Subaccount suspended due to abuse complaint',
        rcpt_meta: makeRcptMeta({ contactId: '1' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'sp-tenant-1' });

      expect(mockFormatterUtils.sendSlackWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ showSupportButton: true, account: 'sp-tenant-1' }),
      );
    });

    it('does not send Slack for non-suspension policy_rejection', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.POLICY_REJECTION, {
        reason: 'Content rejected by spam filter',
        rcpt_meta: makeRcptMeta({ contactId: '1' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'sp-tenant-1' });

      expect(mockFormatterUtils.sendSlackWebhook).not.toHaveBeenCalled();
    });

    it('sends Slack only once per batch even when many suspension events arrive together', async () => {
      const events = [1, 2, 3, 4, 5].map((n) =>
        makeMessageEvent(SparkPostEventTypes.POLICY_REJECTION, {
          reason: 'Account suspended',
          rcpt_meta: makeRcptMeta({ contactId: String(n) }),
          event_id: `s-${n}`,
        }),
      );

      await service.processSparkPost({ payload: events, platform: 'sparkpost' as any, account: 'sp-tenant-1' });

      expect(mockFormatterUtils.sendSlackWebhook).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Dropped (policy_rejection) reason routing
  // ─────────────────────────────────────────────────────────────
  describe('policy_rejection reason routing', () => {
    it('remaps policy_rejection with suppression-list reason to unsubscribe handling', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.POLICY_REJECTION, {
        reason: 'Recipient address is suppressed by Suppression List',
        rcpt_meta: makeRcptMeta({ contactId: '301' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isUnsubscribed: true }),
      );
    });

    it('keeps policy_rejection with content/policy reason as drop (no contact update)', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.POLICY_REJECTION, {
        reason: 'Content violates policy',
        rcpt_meta: makeRcptMeta({ contactId: '302' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).not.toHaveBeenCalled();
      expect(mockMsgopsService.batchUpdateContactsBounce).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Unsubscribe / spam complaint
  // ─────────────────────────────────────────────────────────────
  describe('unsubscribe & spam complaint', () => {
    it('sets isUnsubscribed for link_unsubscribe events', async () => {
      const env = makeUnsubscribeEnvelope(SparkPostEventTypes.LINK_UNSUBSCRIBE);
      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isUnsubscribed: true }),
      );
    });

    it('sets isUnsubscribed for spam_complaint events', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.SPAM_COMPLAINT, {
        rcpt_meta: makeRcptMeta({ contactId: '10' }),
      });
      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isUnsubscribed: true }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Missing context
  // ─────────────────────────────────────────────────────────────
  describe('missing context', () => {
    it('skips events with missing messageId or accountId', async () => {
      mockFormatterUtils.parseEventType.mockReturnValue(null);
      const env = makeMessageEvent(SparkPostEventTypes.DELIVERY, { rcpt_meta: {} });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Missing sparkpost context'));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Event log fields
  // ─────────────────────────────────────────────────────────────
  describe('event log fields', () => {
    it('does not create event log for processed (injection) events', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.INJECTION, {
        rcpt_meta: makeRcptMeta({ contactId: '10' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      if (mockMsgopsService.saveEventsLogs.mock.calls.length > 0) {
        const logs = mockMsgopsService.saveEventsLogs.mock.calls[0][0];
        expect(logs.every((l: any) => l.event !== 'processed')).toBe(true);
      }
    });

    it('includes deferred attempt in properties', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.DELAY, {
        rcpt_meta: makeRcptMeta({ contactId: '10' }),
        ip_address: '1.2.3.4',
        num_retries: 3,
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ attempt: 3 }),
          }),
        ]),
      );
    });

    it('stamps provider=sparkpost in event log', async () => {
      const env = makeMessageEvent(SparkPostEventTypes.DELIVERY, {
        rcpt_meta: makeRcptMeta({ contactId: '10' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ provider: 'sparkpost' })]),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Statistics type resolution
  // ─────────────────────────────────────────────────────────────
  describe('event statistics type resolution', () => {
    it('uses automationId as eventId for automation type events', async () => {
      const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');
      const env = makeMessageEvent(SparkPostEventTypes.DELIVERY, {
        rcpt_meta: makeRcptMeta({ contactId: '10', type: 'email', 'automation-id': '77' }),
      });

      await service.processSparkPost({ payload: [env], platform: 'sparkpost' as any, account: 'acct1' });

      expect(updateStatsSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'automation' }));
    });
  });
});
