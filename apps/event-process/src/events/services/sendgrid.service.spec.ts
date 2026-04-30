import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../providers/redis/redis.service';
import { SendgridService } from './sendgrid.service';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MsgopsService } from '../../msgops/msgops.service';
import { EventPublisherService } from '../../event-publisher.service';
import { CacheService } from '../../msgops/cache.service';
import { GEO_PROVIDER_TOKEN } from '@bms/geo';
import { AnalyticsPublisherProvider } from '../../providers/analytics-publisher.provider';
import { SendgridBounceClassification } from '../interfaces/events.interfaces';

const ACCOUNT_ID = '42';
const TIMESTAMP = 1700000000;

function makeCategory(overrides: Record<string, string> = {}): string[] {
  const defaults = { account: ACCOUNT_ID, message: '1', type: 'campaign', campaign: '99' };
  const merged = { ...defaults, ...overrides };
  return Object.entries(merged).map(([k, v]) => `${k}:${v}`);
}

function makeBounceEvent(overrides: Partial<any> = {}): any {
  return {
    email: 'test@example.com',
    timestamp: TIMESTAMP,
    event: 'bounce',
    type: 'bounce',
    bounce_classification: SendgridBounceClassification.INVALID_ADDRESS,
    reason: '550 user unknown',
    category: makeCategory(),
    sg_event_id: `evt-${Math.random()}`,
    sg_message_id: 'msg-1',
    contactId: '123',
    ...overrides,
  };
}

describe('SendgridService', () => {
  let service: SendgridService;

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
    // Re-apply mock implementations after clearAllMocks (which only clears state, not implementations).
    // Tests that override these with mockReturnValue/mockImplementation will persist
    // across clearAllMocks, so we must explicitly reset them here.
    mockPipeline.exec.mockResolvedValue(Array(50).fill([null, 'OK']));
    mockRedisClient.exists.mockResolvedValue(0);
    mockFormatterUtils.parseEventType.mockImplementation((categories: string[], key: string) => {
      if (!categories) return null;
      const entry = categories.find((c: string) => c.startsWith(`${key}:`));
      return entry ? entry.split(':')[1] : null;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendgridService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: FormatterUtils, useValue: mockFormatterUtils },
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CacheService, useValue: mockCacheService },
        { provide: GEO_PROVIDER_TOKEN, useValue: mockGeolocationService },
        { provide: AnalyticsPublisherProvider, useValue: mockAnalyticsPublisherProvider },
      ],
    }).compile();

    service = module.get<SendgridService>(SendgridService);
  });

  // ─────────────────────────────────────────────────────────────
  // isRecipientIssueBounce
  // ─────────────────────────────────────────────────────────────
  describe('isRecipientIssueBounce', () => {
    const call = (reason: string, bounceClass: string) => (service as any).isRecipientIssueBounce(reason, bounceClass);

    it('returns true for Invalid Address classification', () => {
      expect(call('', SendgridBounceClassification.INVALID_ADDRESS)).toBe(true);
    });

    it('returns true for Mailbox Unavailable classification', () => {
      expect(call('', SendgridBounceClassification.MAILBOX_UNAVAILABLE)).toBe(true);
    });

    it('returns false for Reputation classification', () => {
      expect(call('', SendgridBounceClassification.REPUTATION)).toBe(false);
    });

    it('returns false for Technical classification', () => {
      expect(call('', SendgridBounceClassification.TECHNICAL)).toBe(false);
    });

    it('returns false for Content classification', () => {
      expect(call('', SendgridBounceClassification.CONTENT)).toBe(false);
    });

    it('returns false for Frequency/Volume classification', () => {
      expect(call('', SendgridBounceClassification.FREQUENCY_VOLUME)).toBe(false);
    });

    it('returns false for Unclassified classification', () => {
      expect(call('', SendgridBounceClassification.UNCLASSIFIED)).toBe(false);
    });

    it('returns true via reason fallback: user unknown', () => {
      expect(call('550 User unknown', '')).toBe(true);
    });

    it('returns true via reason fallback: mailbox not found', () => {
      expect(call('552 1 mailbox not found', '')).toBe(true);
    });

    it('returns true via reason fallback: quota exceeded', () => {
      expect(call('452 Quota exceeded', '')).toBe(true);
    });

    it('returns true via reason fallback: account does not exist', () => {
      expect(call('550 The email account that you tried to reach does not exist', '')).toBe(true);
    });

    it('returns false when reason and classification are both empty', () => {
      expect(call('', '')).toBe(false);
    });

    it('returns false when reason is null', () => {
      expect(call(null, '')).toBe(false);
    });

    it('returns false when reason is undefined', () => {
      expect(call(undefined, '')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Bounce contact updates — per-contact bounce_type correctness
  // ─────────────────────────────────────────────────────────────
  describe('bounce contact updates', () => {
    it('marks contact as HARD bounce for bounce event with type=bounce', async () => {
      const event = makeBounceEvent({
        type: 'bounce',
        bounce_classification: SendgridBounceClassification.INVALID_ADDRESS,
        contactId: '10',
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 10, bounceType: 'HARD' })]),
        Number(ACCOUNT_ID),
      );
    });

    it('marks contact as SOFT bounce for bounce event with type=blocked', async () => {
      const event = makeBounceEvent({
        type: 'blocked',
        bounce_classification: SendgridBounceClassification.MAILBOX_UNAVAILABLE,
        contactId: '20',
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 20, bounceType: 'SOFT' })]),
        Number(ACCOUNT_ID),
      );
    });

    it('marks contact as SOFT bounce for blocked event type', async () => {
      const event = makeBounceEvent({
        event: 'blocked',
        type: 'blocked',
        bounce_classification: SendgridBounceClassification.MAILBOX_UNAVAILABLE,
        contactId: '30',
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 30, bounceType: 'SOFT' })]),
        Number(ACCOUNT_ID),
      );
    });

    it('splits a mixed batch: HARD contacts and SOFT contacts in two separate batch calls', async () => {
      const hardEvent = makeBounceEvent({
        type: 'bounce',
        bounce_classification: SendgridBounceClassification.INVALID_ADDRESS,
        contactId: '100',
        email: 'hard@example.com',
        sg_event_id: 'hard-1',
      });
      const softEvent = makeBounceEvent({
        type: 'blocked',
        bounce_classification: SendgridBounceClassification.MAILBOX_UNAVAILABLE,
        contactId: '200',
        email: 'soft@example.com',
        sg_event_id: 'soft-1',
      });

      await service.processSendgrid({ payload: [hardEvent, softEvent], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 100, bounceType: 'HARD' })]),
        Number(ACCOUNT_ID),
      );
      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 200, bounceType: 'SOFT' })]),
        Number(ACCOUNT_ID),
      );
      // Two batch calls: one per bounce type group
      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledTimes(2);
    });

    it('issues exactly two SQL statements regardless of bounce batch size', async () => {
      const events = [1, 2, 3, 4, 5].map((n) =>
        makeBounceEvent({ contactId: String(n), email: `c${n}@example.com`, sg_event_id: `e${n}` }),
      );

      await service.processSendgrid({ payload: events, platform: 'sendgrid' as any, account: 'acct1' });

      // All 5 contacts → one batchUpdateContactsBounce call (HARD group)
      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledTimes(1);
      expect(mockMsgopsService.batchUpsertValidationBounce).toHaveBeenCalledTimes(1);
    });

    it('does NOT call batchUpdateContactsBounce for Reputation bounce', async () => {
      const event = makeBounceEvent({
        bounce_classification: SendgridBounceClassification.REPUTATION,
        reason: '550 Gmail spam',
        contactId: '999',
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).not.toHaveBeenCalled();
    });

    it('does NOT call batchUpdateContactsBounce for Technical bounce', async () => {
      const event = makeBounceEvent({
        bounce_classification: SendgridBounceClassification.TECHNICAL,
        reason: 'Unable to parse',
        contactId: '999',
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).not.toHaveBeenCalled();
    });

    it('gives each contact its own bouncedAt from its own SendGrid timestamp', async () => {
      const t1 = 1700000000;
      const t2 = 1700003600;

      const event1 = makeBounceEvent({ contactId: '10', email: 'a@example.com', timestamp: t1, sg_event_id: 'e1' });
      const event2 = makeBounceEvent({ contactId: '20', email: 'b@example.com', timestamp: t2, sg_event_id: 'e2' });

      await service.processSendgrid({ payload: [event1, event2], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 10, bouncedAt: new Date(t1 * 1000) }),
          expect.objectContaining({ id: 20, bouncedAt: new Date(t2 * 1000) }),
        ]),
        Number(ACCOUNT_ID),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Edge cases: duplicate emails and hard/soft precedence
  // ─────────────────────────────────────────────────────────────
  describe('bounce edge cases', () => {
    it('deduplicates contactIds in batchUpdateContactsBounce when same contact appears multiple times, keeping latest timestamp', async () => {
      const t1 = 1700000000;
      const t2 = 1700003600; // 1 hour later — should win

      const event1 = makeBounceEvent({ contactId: '99', email: 'a@example.com', timestamp: t1, sg_event_id: 'dup-c1' });
      const event2 = makeBounceEvent({ contactId: '99', email: 'b@example.com', timestamp: t2, sg_event_id: 'dup-c2' });

      await service.processSendgrid({ payload: [event1, event2], platform: 'sendgrid' as any, account: 'acct1' });

      const calls = mockMsgopsService.batchUpdateContactsBounce.mock.calls[0][0] as any[];
      const contactEntries = calls.filter((e: any) => e.id === 99);

      // Must be deduplicated to a single entry
      expect(contactEntries).toHaveLength(1);
      // Latest timestamp wins
      expect(contactEntries[0].bouncedAt).toEqual(new Date(t2 * 1000));
    });

    it('deduplicates emails in batchUpsertValidationBounce when same email appears multiple times', async () => {
      const t1 = 1700000000;
      const t2 = 1700003600; // 1 hour later — should win

      // Same email, two different events at different timestamps
      const event1 = makeBounceEvent({
        email: 'dup@example.com',
        contactId: '10',
        timestamp: t1,
        sg_event_id: 'dup-1',
      });
      const event2 = makeBounceEvent({
        email: 'dup@example.com',
        contactId: '11',
        timestamp: t2,
        sg_event_id: 'dup-2',
      });

      await service.processSendgrid({ payload: [event1, event2], platform: 'sendgrid' as any, account: 'acct1' });

      const calls = mockMsgopsService.batchUpsertValidationBounce.mock.calls[0][0] as any[];
      const emailEntries = calls.filter((e: any) => e.email === 'dup@example.com');

      // Must be deduplicated to a single entry
      expect(emailEntries).toHaveLength(1);
      // Latest timestamp wins
      expect(emailEntries[0].bouncedAt).toEqual(new Date(t2 * 1000));
    });

    it('hard bounce wins when same contact appears in both hard and soft groups', async () => {
      const SHARED_CONTACT = '42';

      const hardEvent = makeBounceEvent({
        type: 'bounce',
        bounce_classification: SendgridBounceClassification.INVALID_ADDRESS,
        contactId: SHARED_CONTACT,
        email: 'shared@example.com',
        sg_event_id: 'hard-shared',
      });
      const softEvent = makeBounceEvent({
        type: 'blocked',
        bounce_classification: SendgridBounceClassification.MAILBOX_UNAVAILABLE,
        contactId: SHARED_CONTACT,
        email: 'shared@example.com',
        sg_event_id: 'soft-shared',
      });

      await service.processSendgrid({ payload: [hardEvent, softEvent], platform: 'sendgrid' as any, account: 'acct1' });

      // Contact must appear in the HARD batch call
      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 42, bounceType: 'HARD' })]),
        Number(ACCOUNT_ID),
      );

      // Contact must NOT appear in the SOFT batch call
      const softCall = mockMsgopsService.batchUpdateContactsBounce.mock.calls.find(([entries]) =>
        entries.some((e: any) => e.bounceType === 'SOFT'),
      );
      if (softCall) {
        expect(softCall[0]).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 42 })]));
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // group_resubscribe
  // ─────────────────────────────────────────────────────────────
  describe('group_resubscribe', () => {
    function makeResubscribeEvent(overrides: Partial<any> = {}): any {
      return {
        email: 'user@example.com',
        timestamp: TIMESTAMP,
        event: 'group_resubscribe',
        category: makeCategory(),
        sg_event_id: `resub-${Math.random()}`,
        sg_message_id: 'msg-resub',
        contactId: '55',
        ...overrides,
      };
    }

    it('sets isUnsubscribed to false when user resubscribes', async () => {
      const event = makeResubscribeEvent();

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isUnsubscribed: false }),
      );
    });

    it('clears unsubscribedAt (sets to null) when user resubscribes', async () => {
      const event = makeResubscribeEvent();

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ unsubscribedAt: null }),
      );
    });

    it('deletes the Redis unsubscribed key when user resubscribes', async () => {
      const event = makeResubscribeEvent({ email: 'user@example.com' });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(mockPipeline.del).toHaveBeenCalledWith(`${ACCOUNT_ID}:unsubscribed:user@example.com`);
    });

    it('clears email_validations.unsubscribed_at via clearValidationUnsubscribed', async () => {
      const event = makeResubscribeEvent({ email: 'user@example.com' });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.clearValidationUnsubscribed).toHaveBeenCalledWith(
        expect.arrayContaining(['user@example.com']),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // A/B test Redis counters
  // ─────────────────────────────────────────────────────────────
  describe('A/B test event counters', () => {
    function makeTestAbBounceEvent(overrides: Partial<any> = {}): any {
      return makeBounceEvent({
        // testab-message in category triggers A/B tracking
        category: [...makeCategory(), 'testab-message:1'],
        ...overrides,
      });
    }

    beforeEach(() => {
      // Simulate the A/B key existing in Redis so hincrby is called
      mockRedisClient.exists.mockResolvedValue(1);
    });

    it('increments "bounce" counter for recipient-issue bounce in A/B test', async () => {
      const event = makeTestAbBounceEvent({
        type: 'bounce',
        bounce_classification: SendgridBounceClassification.INVALID_ADDRESS,
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining('testab:campaign:'), 'bounce', 1);
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.stringContaining('testab:campaign:'), 'blocked', 1);
    });

    it('increments "blocked" counter (not "bounce") for Reputation bounce in A/B test', async () => {
      const event = makeTestAbBounceEvent({
        bounce_classification: SendgridBounceClassification.REPUTATION,
        reason: '550 Gmail spam policy',
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining('testab:campaign:'), 'blocked', 1);
      expect(mockPipeline.hincrby).not.toHaveBeenCalledWith(expect.stringContaining('testab:campaign:'), 'bounce', 1);
    });

    it('increments "blocked" counter for Technical bounce in A/B test', async () => {
      const event = makeTestAbBounceEvent({
        bounce_classification: SendgridBounceClassification.TECHNICAL,
        reason: 'Unable to parse reason',
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining('testab:campaign:'), 'blocked', 1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Event statistics — sender-issue bounces tracked as 'blocked'
  // ─────────────────────────────────────────────────────────────
  describe('event statistics for bounce events', () => {
    it('tracks Reputation bounce as "blocked" in statistics, not "bounce"', async () => {
      const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');

      const event = makeBounceEvent({
        bounce_classification: SendgridBounceClassification.REPUTATION,
        reason: '550 Gmail spam policy',
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(updateStatsSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ event: 'blocked' }));
      expect(updateStatsSpy).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ event: 'bounce' }));
    });

    it('tracks recipient-issue bounce as "bounce" in statistics', async () => {
      const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');

      const event = makeBounceEvent({
        bounce_classification: SendgridBounceClassification.INVALID_ADDRESS,
        type: 'bounce',
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(updateStatsSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ event: 'bounce' }));
    });

    it('tracks Technical bounce as "blocked" in statistics', async () => {
      const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');

      const event = makeBounceEvent({
        bounce_classification: SendgridBounceClassification.TECHNICAL,
        reason: 'Unable to parse reason from bounce report',
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(updateStatsSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ event: 'blocked' }));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Bounce properties saved in event log
  // ─────────────────────────────────────────────────────────────
  describe('bounce event log properties', () => {
    it('saves bounce_classification in event log properties', async () => {
      const event = makeBounceEvent({ bounce_classification: SendgridBounceClassification.REPUTATION });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({
              bounce_classification: SendgridBounceClassification.REPUTATION,
            }),
          }),
        ]),
      );
    });

    it('saves bounce_type=HARD in event log properties for hard bounce', async () => {
      const event = makeBounceEvent({ type: 'bounce' });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ bounce_type: 'HARD' }),
          }),
        ]),
      );
    });

    it('saves bounce_type=SOFT in event log properties for soft bounce', async () => {
      const event = makeBounceEvent({
        type: 'blocked',
        bounce_classification: SendgridBounceClassification.MAILBOX_UNAVAILABLE,
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ bounce_type: 'SOFT' }),
          }),
        ]),
      );
    });

    it('saves reason at top-level of event log (not inside properties)', async () => {
      const event = makeBounceEvent({
        reason: '550 User unknown',
        bounce_classification: SendgridBounceClassification.INVALID_ADDRESS,
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

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
  // account_status_change handling
  // ─────────────────────────────────────────────────────────────
  describe('account_status_change', () => {
    it('should send Slack webhook when account_status_change event received', async () => {
      const event = {
        email: 'test@example.com',
        timestamp: TIMESTAMP,
        event: 'account_status_change',
        category: [],
        sg_event_id: 'status-1',
        sg_message_id: 'msg-1',
      };

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockFormatterUtils.sendSlackWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ showSupportButton: true }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Duplicate event filtering
  // ─────────────────────────────────────────────────────────────
  describe('duplicate event filtering', () => {
    it('should return skipped status when all events are duplicates', async () => {
      mockPipeline.exec.mockResolvedValueOnce([[null, null]]); // NX returns null = duplicate
      const event = {
        email: 'test@example.com',
        timestamp: TIMESTAMP,
        event: 'delivered',
        category: makeCategory(),
        sg_event_id: 'dup-1',
        sg_message_id: 'msg-1',
      };

      const result = await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(result).toEqual(expect.objectContaining({ status: 'skipped' }));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Dropped event routing
  // ─────────────────────────────────────────────────────────────
  describe('dropped event routing', () => {
    function makeDroppedEvent(reason: string, overrides = {}): any {
      return {
        email: 'user@example.com',
        timestamp: TIMESTAMP,
        event: 'dropped',
        category: makeCategory(),
        sg_event_id: `drop-${Math.random()}`,
        sg_message_id: 'msg-1',
        reason,
        contactId: '10',
        ...overrides,
      };
    }

    it('should remap dropped+Unsubscribed Address to unsubscribe group', async () => {
      const event = makeDroppedEvent('Unsubscribed Address');
      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isUnsubscribed: true }),
      );
    });

    it('should remap dropped+Bounced Address to bounce group', async () => {
      const event = makeDroppedEvent('Bounced Address');
      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.batchUpdateContactsBounce).toHaveBeenCalled();
    });

    it('should send Slack webhook for dropped+Invalid SMTPAPI header', async () => {
      const event = makeDroppedEvent('Invalid SMTPAPI header');
      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockFormatterUtils.sendSlackWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ showSupportButton: false }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Open/click event processing
  // ─────────────────────────────────────────────────────────────
  describe('open/click event processing', () => {
    function makeOpenEvent(overrides = {}): any {
      return {
        email: 'user@example.com',
        timestamp: TIMESTAMP,
        event: 'open',
        category: makeCategory(),
        sg_event_id: `open-${Math.random()}`,
        sg_message_id: 'msg-1',
        contactId: '10',
        ip: '1.2.3.4',
        useragent: 'Mozilla/5.0 Chrome/120',
        ...overrides,
      };
    }

    it('should set lastOpen/lastOpenDate/isActive for open events', async () => {
      const event = makeOpenEvent();
      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isActive: true }),
      );
    });

    it('should set lastClick for click events', async () => {
      const event = makeOpenEvent({ event: 'click', url: 'https://example.com' });
      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isActive: true }),
      );
    });

    it('should build activation event when contact last_open is null', async () => {
      mockMsgopsService.findContactById.mockResolvedValueOnce({
        id: 10,
        last_open: null,
        last_click: null,
        uuid: 'u1',
        email: 'user@example.com',
        ip: '1.2.3.4',
      });

      const event = makeOpenEvent();
      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('should fetch geoIP for open events with IP', async () => {
      mockGeolocationService.lookup.mockResolvedValueOnce({ country: 'BR', region: 'SP', city: 'SP' });
      const event = makeOpenEvent({ ip: '8.8.8.8' });
      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockGeolocationService.lookup).toHaveBeenCalledWith('8.8.8.8');
    });

    it('should check automation target Redis key for open/click events', async () => {
      mockRedisClient.exists.mockResolvedValue(1);
      mockFormatterUtils.parseEventType.mockImplementation((categories: string[], key: string) => {
        if (!categories) return null;
        const entry = categories.find((c) => c.startsWith(`${key}:`));
        return entry ? entry.split(':')[1] : null;
      });

      const event = makeOpenEvent({
        category: [...makeCategory(), 'automation-id:77'],
      });

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Delivered event processing
  // ─────────────────────────────────────────────────────────────
  describe('delivered event processing', () => {
    it('should set lastSent/lastSentDate for delivered events', async () => {
      const event = {
        email: 'user@example.com',
        timestamp: TIMESTAMP,
        event: 'delivered',
        category: makeCategory(),
        sg_event_id: `del-${Math.random()}`,
        sg_message_id: 'msg-1',
        contactId: '10',
      };

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ lastSent: expect.any(Date) }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Unsubscribe event processing
  // ─────────────────────────────────────────────────────────────
  describe('unsubscribe event processing', () => {
    it('should set isUnsubscribed for unsubscribe events', async () => {
      const event = {
        email: 'user@example.com',
        timestamp: TIMESTAMP,
        event: 'unsubscribe',
        category: makeCategory(),
        sg_event_id: `unsub-${Math.random()}`,
        sg_message_id: 'msg-1',
        contactId: '10',
      };

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isUnsubscribed: true }),
      );
    });

    it('should set isUnsubscribed for spamreport events', async () => {
      const event = {
        email: 'user@example.com',
        timestamp: TIMESTAMP,
        event: 'spamreport',
        category: makeCategory(),
        sg_event_id: `spam-${Math.random()}`,
        sg_message_id: 'msg-1',
        contactId: '10',
      };

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.updateContactsById).toHaveBeenCalledWith(
        expect.any(Array),
        Number(ACCOUNT_ID),
        expect.objectContaining({ isUnsubscribed: true }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Missing context / invalid events
  // ─────────────────────────────────────────────────────────────
  describe('missing context', () => {
    it('should skip events with missing messageId or accountId', async () => {
      mockFormatterUtils.parseEventType.mockReturnValue(null);
      const event = {
        email: 'test@example.com',
        timestamp: TIMESTAMP,
        event: 'delivered',
        category: [],
        sg_event_id: 'ctx-1',
        sg_message_id: 'msg-1',
      };

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith(expect.stringContaining('Missing sendgrid context'));
    });

    it('should skip events with invalid event types', async () => {
      const event = {
        email: 'test@example.com',
        timestamp: TIMESTAMP,
        event: 'some_unknown_event',
        category: makeCategory(),
        sg_event_id: 'unk-1',
        sg_message_id: 'msg-1',
      };

      const result = await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });
      expect(result).toEqual({});
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Event log fields
  // ─────────────────────────────────────────────────────────────
  describe('event log fields', () => {
    it('should include linkPosition for click events with url_offset', async () => {
      const event = {
        email: 'user@example.com',
        timestamp: TIMESTAMP,
        event: 'click',
        category: makeCategory(),
        sg_event_id: `click-${Math.random()}`,
        sg_message_id: 'msg-1',
        contactId: '10',
        ip: '1.2.3.4',
        useragent: 'Chrome/120',
        url: 'https://example.com',
        url_offset: { index: 5, type: 'html' },
      };

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ linkPosition: 5 })]),
      );
    });

    it('should not create event log for processed events', async () => {
      const event = {
        email: 'user@example.com',
        timestamp: TIMESTAMP,
        event: 'processed',
        category: makeCategory(),
        sg_event_id: `proc-${Math.random()}`,
        sg_message_id: 'msg-1',
        contactId: '10',
      };

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      // processed events should not be in save logs
      if (mockMsgopsService.saveEventsLogs.mock.calls.length > 0) {
        const logs = mockMsgopsService.saveEventsLogs.mock.calls[0][0];
        expect(logs.every((l: any) => l.event !== 'processed')).toBe(true);
      }
    });

    it('should include deferred attempt in properties', async () => {
      const event = {
        email: 'user@example.com',
        timestamp: TIMESTAMP,
        event: 'deferred',
        category: makeCategory(),
        sg_event_id: `def-${Math.random()}`,
        sg_message_id: 'msg-1',
        contactId: '10',
        ip: '1.2.3.4',
        attempt: 3,
      };

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(mockMsgopsService.saveEventsLogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ attempt: 3 }),
          }),
        ]),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Event statistics types
  // ─────────────────────────────────────────────────────────────
  describe('event statistics type resolution', () => {
    it('should use automationId as eventId for automation type events', async () => {
      const updateStatsSpy = jest.spyOn(service as any, 'updateEventStatistics');
      const event = {
        email: 'user@example.com',
        timestamp: TIMESTAMP,
        event: 'delivered',
        category: [...makeCategory({ type: 'email' }), 'automation-id:77'],
        sg_event_id: `auto-${Math.random()}`,
        sg_message_id: 'msg-1',
        contactId: '10',
      };

      await service.processSendgrid({ payload: [event], platform: 'sendgrid' as any, account: 'acct1' });

      expect(updateStatsSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'automation' }));
    });
  });
});
