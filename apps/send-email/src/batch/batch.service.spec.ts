import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BatchService } from './batch.service';
import { MailService } from '../mail/mail.service';
import { MailUtils } from '../mail/mail.utils';
import { FormatterUtils } from '../utils/formatter.utils';
import { RedisService } from '../providers/redis/redis.service';
import { TrackerService } from '../tracker/tracker.service';
import { PubSubProvider } from '../providers/pubsub.provider';
import { Batch } from '../mail/mail.interface';

/**
 * Factory function to create mock Batch data
 * Reduces boilerplate and provides consistent test data
 */
const createMockBatch = (overrides: Partial<Batch> = {}): any => ({
  campaign_id: 123,
  campaign_name: 'Test Campaign',
  campaign_test_ab_mode: false,
  // Note: is_campaign_warmup_mode is intentionally omitted from default
  // The code checks `if ('is_campaign_warmup_mode' in batch)`, not the value
  // Only add this property when testing warmup mode behavior
  page: 1,
  totalPages: 1,
  account: {
    id: 1,
    name: 'Test Account',
    accountConfigs: [
      { accountId: 1, name: 'time_zone', value: 'America/Sao_Paulo' },
      { accountId: 1, name: 'send_limit_per_user', value: '100' },
    ],
  },
  campaign: {
    id: 123,
    title: 'Test Campaign',
    name: 'test-campaign',
    accountId: 1,
    status: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    spreadSending: 0,
    query: '',
    steps: '',
    account: { id: 1 },
    type: null,
    messageType: null,
    isWarmup: false,
    isRateLimit: true,
    campaignDefault: {
      id: 456,
      campaignId: 456,
    },
  },
  contacts: [
    {
      id: 1,
      email: 'test1@example.com',
      firstName: 'John',
      isValid: true,
      uuid: 'uuid-1',
    },
    {
      id: 2,
      email: 'test2@example.com',
      firstName: 'Jane',
      isValid: true,
      uuid: 'uuid-2',
    },
  ],
  message: {
    id: 1,
    title: 'Test Email',
    name: 'test-email',
    fromMail: 'sender@example.com',
    fromName: 'Sender Name',
    ippool: 'default-pool',
    replyTo: 'reply@example.com',
    subject: 'Test Subject',
    bucketName: 'test-bucket',
    fileName: 'test-file.html',
    content: '<p>Test content</p>',
    previewText: 'Preview text',
  },
  ...overrides,
});

describe('BatchService', () => {
  let service: BatchService;
  let mailService: MailService;
  let mailUtils: MailUtils;
  let redisService: RedisService;
  let trackerService: TrackerService;
  let pubSubProvider: PubSubProvider;
  let redisClient: any;

  beforeEach(async () => {
    // Redis client mock
    redisClient = {
      mget: jest.fn().mockResolvedValue([null, null]),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      incrby: jest.fn((key, value, callback) => {
        if (callback) callback(null, 1);
        return Promise.resolve(1);
      }),
      expire: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchService,
        {
          provide: MailService,
          useValue: {
            sendBatch: jest.fn().mockResolvedValue([{ statusCode: 202, results: { id: 'test-id' } }]),
          },
        },
        {
          provide: MailUtils,
          useValue: {
            getAccountConfig: jest.fn((configs, key) => {
              const config = configs?.find((c) => c.name === key);
              return config?.value;
            }),
            isMicrosoft: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: FormatterUtils,
          useValue: {
            slugify: jest.fn((text) => text?.toLowerCase().replace(/\s+/g, '-')),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(redisClient),
          },
        },
        {
          provide: TrackerService,
          useValue: {
            logDebug: jest.fn(),
            logError: jest.fn(),
          },
        },
        {
          provide: PubSubProvider,
          useValue: {
            sendAsyncMessage: jest.fn().mockResolvedValue(true),
            sendAsyncMessage2: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<BatchService>(BatchService);
    mailService = module.get<MailService>(MailService);
    mailUtils = module.get<MailUtils>(MailUtils);
    module.get<FormatterUtils>(FormatterUtils);
    redisService = module.get<RedisService>(RedisService);
    trackerService = module.get<TrackerService>(TrackerService);
    pubSubProvider = module.get<PubSubProvider>(PubSubProvider);

    // Set environment variable for validation
    process.env.LIMIT_CONTACT_BATCH = '1000';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('campaignBatch', () => {
    it('should process campaign batch successfully', async () => {
      const mockBatch = createMockBatch();

      const result = await service.campaignBatch(mockBatch, null);

      expect(result).toEqual([{ statusCode: 202, results: { id: 'test-id' } }]);
      expect(mailService.sendBatch).toHaveBeenCalledWith(mockBatch, null);
    });

    describe('tracker behavior', () => {
      it('should send EMAIL_BATCH tracker at start when debug is NOT set', async () => {
        const mockBatch = createMockBatch();

        await service.campaignBatch(mockBatch, null);

        // Critical: Must track batch start for monitoring
        expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            campaign_id: 123,
            service: 'MSGOPS_SEND_BATCH_EMAIL',
            event: 'EMAIL_BATCH',
            contacts_length: 2,
          }),
        );
      });

      it('should send SENT_EMAIL_BATCH tracker at end when debug is NOT set and NOT warmup mode', async () => {
        const mockBatch = createMockBatch();

        await service.campaignBatch(mockBatch, null);

        // Critical: Must track batch completion for statistics
        expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'SENT_EMAIL_BATCH',
            campaign_id: 123,
            data: [{ statusCode: 202, results: { id: 'test-id' } }],
          }),
        );
      });

      it('should skip both trackers when debug is set', async () => {
        const mockBatch = createMockBatch();

        await service.campaignBatch(mockBatch, 'true');

        // When debugging, no trackers should be sent to avoid polluting analytics
        expect(pubSubProvider.sendAsyncMessage).not.toHaveBeenCalled();
      });

      it('should skip SENT_EMAIL_BATCH tracker when in warmup mode', async () => {
        const mockBatch = createMockBatch({
          is_campaign_warmup_mode: true,
        });

        await service.campaignBatch(mockBatch, null);

        // Should send EMAIL_BATCH (start tracker)
        expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'EMAIL_BATCH',
          }),
        );

        // Should NOT send SENT_EMAIL_BATCH (end tracker) in warmup mode
        expect(pubSubProvider.sendAsyncMessage).not.toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'SENT_EMAIL_BATCH',
          }),
        );
      });
    });

    describe('campaign warmup mode processing', () => {
      it('should process campaign_id from campaignDefault when is_campaign_warmup_mode is true', async () => {
        const mockBatch = createMockBatch({
          is_campaign_warmup_mode: true,
          campaign_id: 999, // Original ID (will be overwritten)
          campaign: {
            ...createMockBatch().campaign,
            id: 999,
            campaignDefault: {
              id: 456,
              campaignId: 789, // Preferred value
            },
          },
        });

        await service.campaignBatch(mockBatch, 'true'); // debug to skip trackers

        // Critical: Warmup mode must use campaignDefault.campaignId (or fallback to id)
        expect(mockBatch.campaign_id).toBe(789);
        expect(mockBatch.campaign.id).toBe(789);
      });

      it('should fallback to campaignDefault.id when campaignId is not present', async () => {
        const mockBatch = createMockBatch({
          is_campaign_warmup_mode: true,
          campaign: {
            ...createMockBatch().campaign,
            campaignDefault: {
              id: 456,
              // campaignId is missing
            },
          },
        });

        await service.campaignBatch(mockBatch, 'true');

        // Fallback to id when campaignId is missing
        expect(mockBatch.campaign_id).toBe(456);
        expect(mockBatch.campaign.id).toBe(456);
      });
    });

    describe('contact cleanup and validation', () => {
      it('should return status false when contacts array is empty after cleanup', async () => {
        const mockBatch = createMockBatch({
          contacts: [{ id: 1, email: 'blocked@example.com', isValid: true, uuid: 'uuid-1' }],
        });

        // Mock cleanup to return empty array (all contacts filtered)
        redisClient.mget.mockResolvedValue(['true']); // Contact is blocked

        const result = await service.campaignBatch(mockBatch, null);

        // Critical: Must return status false when no contacts remain
        expect(result).toEqual({ status: false });
        expect(mailService.sendBatch).not.toHaveBeenCalled();

        // Should still send SENT_EMAIL_BATCH tracker with empty result
        expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'SENT_EMAIL_BATCH',
            data: {},
          }),
        );
      });
    });

    describe('validateCampaign', () => {
      it('should throw BadRequestException when contacts array is empty', () => {
        const mockBatch = createMockBatch({ contacts: [] });

        expect(() => service.validateCampaign(mockBatch)).toThrow(BadRequestException);
        expect(() => service.validateCampaign(mockBatch)).toThrow('Need contacts to send email');
      });

      it('should throw BadRequestException when contacts exceed limit', () => {
        process.env.LIMIT_CONTACT_BATCH = '5';
        const mockBatch = createMockBatch({
          contacts: Array.from({ length: 10 }, (_, i) => ({
            id: i,
            email: `test${i}@example.com`,
            isValid: true,
            uuid: `uuid-${i}`,
          })),
        });

        expect(() => service.validateCampaign(mockBatch)).toThrow(BadRequestException);
        expect(() => service.validateCampaign(mockBatch)).toThrow('Limit of contacts per batch was exceeded');
      });

      it('should throw BadRequestException when message.subject is missing', () => {
        const mockBatch = createMockBatch({
          message: { ...createMockBatch().message, subject: null },
        });

        expect(() => service.validateCampaign(mockBatch)).toThrow(BadRequestException);
      });

      it('should throw BadRequestException when message.fromMail is missing', () => {
        const mockBatch = createMockBatch({
          message: { ...createMockBatch().message, fromMail: null },
        });

        expect(() => service.validateCampaign(mockBatch)).toThrow(BadRequestException);
      });

      it('should throw BadRequestException when content AND location are missing', () => {
        const mockBatch = createMockBatch({
          message: {
            ...createMockBatch().message,
            content: null,
            fileName: null,
            bucketName: null,
          },
        });

        expect(() => service.validateCampaign(mockBatch)).toThrow(BadRequestException);
        expect(() => service.validateCampaign(mockBatch)).toThrow('Email must contain content or location object');
      });
    });

    describe('cleanupContacts', () => {
      const createMockContacts = () => [
        { id: 1, email: 'user1@example.com', isValid: true, uuid: 'uuid-1' },
        { id: 2, email: 'user2@example.com', isValid: true, uuid: 'uuid-2' },
        { id: 3, email: 'user3@example.com', isValid: true, uuid: 'uuid-3' },
      ];

      it('should return empty array immediately when contacts array is empty', async () => {
        const result = await service.cleanupContacts([], 'duplicated', 'test-email', 1);

        expect(result).toEqual([]);
        // Redis should not be called when array is empty
        expect(redisService.getOrThrow).not.toHaveBeenCalled();
      });

      describe('category-specific filtering', () => {
        it.each([
          {
            category: 'duplicated',
            emailTitle: 'Test Email',
            accountId: 1,
            expectedKeys: ['1:user1@example.com:test-email', '1:user2@example.com:test-email', '1:user3@example.com:test-email'],
            description: 'duplicated - uses accountId, email, and slugified emailTitle',
          },
          {
            category: '1:disengaged',
            emailTitle: 'Test Email',
            accountId: 1,
            expectedKeys: ['1:disengaged:user1@example.com', '1:disengaged:user2@example.com', '1:disengaged:user3@example.com'],
            description: 'disengaged by account - uses category:email pattern',
          },
          {
            category: '1:unsubscribed',
            emailTitle: 'Test Email',
            accountId: 1,
            expectedKeys: ['1:unsubscribed:user1@example.com', '1:unsubscribed:user2@example.com', '1:unsubscribed:user3@example.com'],
            description: 'unsubscribed by account - uses category:email pattern',
          },
          {
            category: '1:blocked',
            emailTitle: 'Test Email',
            accountId: 1,
            expectedKeys: ['1:blocked:user1@example.com', '1:blocked:user2@example.com', '1:blocked:user3@example.com'],
            description: 'blocked by account - uses category:email pattern',
          },
        ])('should query Redis correctly for $description', async ({ category, emailTitle, accountId, expectedKeys }) => {
          const contacts = createMockContacts();
          redisClient.mget.mockResolvedValue([null, null, null]); // All contacts are clean

          await service.cleanupContacts(contacts, category, emailTitle, accountId);

          // Critical: Must use correct Redis key format for each category
          expect(redisClient.mget).toHaveBeenCalledWith(expectedKeys);
        });
      });

      it('should keep only contacts NOT present in Redis (filter out those marked as "true")', async () => {
        const contacts = createMockContacts();

        // Redis returns: user1 is clean (null), user2 is blocked ('true'), user3 is clean (null)
        redisClient.mget.mockResolvedValue([null, 'true', null]);

        const result = await service.cleanupContacts(contacts, '1:blocked', 'test-email', 1);

        // Should keep only user1 and user3 (user2 was filtered out)
        expect(result).toEqual([
          { id: 1, email: 'user1@example.com', isValid: true, uuid: 'uuid-1' },
          { id: 3, email: 'user3@example.com', isValid: true, uuid: 'uuid-3' },
        ]);
        expect(result.length).toBe(2);
      });

      it('should return all contacts when none are present in Redis', async () => {
        const contacts = createMockContacts();
        redisClient.mget.mockResolvedValue([null, null, null]); // All clean

        const result = await service.cleanupContacts(contacts, 'duplicated', 'test-email', 1);

        expect(result).toEqual(contacts);
        expect(result.length).toBe(3);
      });

      it('should return empty array when all contacts are present in Redis', async () => {
        const contacts = createMockContacts();
        redisClient.mget.mockResolvedValue(['true', 'true', 'true']); // All blocked

        const result = await service.cleanupContacts(contacts, '1:blocked', 'test-email', 1);

        expect(result).toEqual([]);
        expect(result.length).toBe(0);
      });

      it('should log debug message for each filtered contact', async () => {
        const contacts = createMockContacts();
        redisClient.mget.mockResolvedValue([null, 'true', 'true']); // Filter user2 and user3

        await service.cleanupContacts(contacts, '1:unsubscribed', 'Test Email', 1);

        // Should log each filtered email
        expect(trackerService.logDebug).toHaveBeenCalledWith('1:UNSUBSCRIBED:  - user2@example.com - test-email');
        expect(trackerService.logDebug).toHaveBeenCalledWith('1:UNSUBSCRIBED:  - user3@example.com - test-email');
        expect(trackerService.logDebug).toHaveBeenCalledTimes(2);
      });
    });

    describe('cleanupContactsQuantity', () => {
      const createMockContacts = () => [
        { id: 101, email: 'user1@example.com', isValid: true, uuid: 'uuid-1' },
        { id: 102, email: 'user2@example.com', isValid: true, uuid: 'uuid-2' },
        { id: 103, email: 'user3@example.com', isValid: true, uuid: 'uuid-3' },
      ];

      it('should return empty array immediately when contacts array is empty', async () => {
        const result = await service.cleanupContactsQuantity([], 100, 'America/Sao_Paulo');

        expect(result).toEqual([]);
        // Redis should not be called when array is empty
        expect(redisService.getOrThrow).not.toHaveBeenCalled();
      });

      it('should query Redis with keys formatted by contact ID and current date in timezone', async () => {
        const contacts = createMockContacts();
        const timezone = 'America/Sao_Paulo';
        const sendLimit = 100;

        redisClient.mget.mockResolvedValue([null, null, null]);

        await service.cleanupContactsQuantity(contacts, sendLimit, timezone);

        // Critical: Redis keys must include contact ID and date in format contact_send:{id}:{YYYY-MM-DD}
        expect(redisClient.mget).toHaveBeenCalled();
        const calledKeys = redisClient.mget.mock.calls[0][0];
        expect(calledKeys).toHaveLength(3);
        expect(calledKeys[0]).toMatch(/^contact_send:101:\d{4}-\d{2}-\d{2}$/);
        expect(calledKeys[1]).toMatch(/^contact_send:102:\d{4}-\d{2}-\d{2}$/);
        expect(calledKeys[2]).toMatch(/^contact_send:103:\d{4}-\d{2}-\d{2}$/);
      });

      it('should keep contacts below sendLimitPerUser threshold', async () => {
        const contacts = createMockContacts();
        const sendLimit = 10;

        // user1: 5 sent (below limit), user2: 10 sent (at limit), user3: 0 sent
        redisClient.mget.mockResolvedValue(['5', '10', '0']);

        const result = await service.cleanupContactsQuantity(contacts, sendLimit, 'America/Sao_Paulo');

        // user1 (5 < 10) and user3 (0 < 10) should pass, user2 (10 >= 10) should be filtered
        expect(result).toEqual([
          { id: 101, email: 'user1@example.com', isValid: true, uuid: 'uuid-1' },
          { id: 103, email: 'user3@example.com', isValid: true, uuid: 'uuid-3' },
        ]);
        expect(result.length).toBe(2);
      });

      it('should filter contacts that reached sendLimitPerUser threshold', async () => {
        const contacts = createMockContacts();
        const sendLimit = 5;

        // user1: 4 sent (below), user2: 5 sent (at limit), user3: 6 sent (above limit)
        redisClient.mget.mockResolvedValue(['4', '5', '6']);

        const result = await service.cleanupContactsQuantity(contacts, sendLimit, 'America/Sao_Paulo');

        // Critical: Filter when alreadySent >= sendLimitPerUser
        // Only user1 (4 < 5) should pass
        expect(result).toEqual([{ id: 101, email: 'user1@example.com', isValid: true, uuid: 'uuid-1' }]);
        expect(result.length).toBe(1);
      });

      it('should return all contacts when none have reached limit', async () => {
        const contacts = createMockContacts();
        const sendLimit = 100;

        // All contacts have low send counts
        redisClient.mget.mockResolvedValue(['10', '20', '30']);

        const result = await service.cleanupContactsQuantity(contacts, sendLimit, 'America/Sao_Paulo');

        expect(result).toEqual(contacts);
        expect(result.length).toBe(3);
      });

      it('should return empty array when all contacts reached limit', async () => {
        const contacts = createMockContacts();
        const sendLimit = 10;

        // All contacts at or above limit
        redisClient.mget.mockResolvedValue(['10', '15', '20']);

        const result = await service.cleanupContactsQuantity(contacts, sendLimit, 'America/Sao_Paulo');

        expect(result).toEqual([]);
        expect(result.length).toBe(0);
      });

      it('should respect timezone when formatting date for Redis keys', async () => {
        const contacts = [{ id: 101, email: 'user1@example.com', isValid: true, uuid: 'uuid-1' }];

        // Test with different timezone
        const timezone = 'America/New_York';
        redisClient.mget.mockResolvedValue([null]);

        await service.cleanupContactsQuantity(contacts, 100, timezone);

        // Verify timezone was used (exact date depends on mock, but key format is verified)
        expect(redisClient.mget).toHaveBeenCalled();
        const calledKeys = redisClient.mget.mock.calls[0][0];
        expect(calledKeys[0]).toMatch(/^contact_send:101:\d{4}-\d{2}-\d{2}$/);
      });

      it('should log message when contact limit is reached', async () => {
        const contacts = createMockContacts();
        const sendLimit = 10;

        // user2 and user3 reached limit
        redisClient.mget.mockResolvedValue(['5', '10', '15']);

        // Mock console.log to capture output
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        await service.cleanupContactsQuantity(contacts, sendLimit, 'America/Sao_Paulo');

        // Should log for contacts that reached limit
        expect(consoleLogSpy).toHaveBeenCalledWith('Contact limit reached:  - user2@example.com');
        expect(consoleLogSpy).toHaveBeenCalledWith('Contact limit reached:  - user3@example.com');
        expect(consoleLogSpy).toHaveBeenCalledTimes(2);

        consoleLogSpy.mockRestore();
      });

      it('should handle null/undefined Redis values (treat as 0 sent)', async () => {
        const contacts = createMockContacts();
        const sendLimit = 10;

        // Redis returns null for contacts never sent before
        redisClient.mget.mockResolvedValue([null, undefined, null]);

        const result = await service.cleanupContactsQuantity(contacts, sendLimit, 'America/Sao_Paulo');

        // All should pass (null/undefined < sendLimit)
        expect(result).toEqual(contacts);
        expect(result.length).toBe(3);
      });
    });

    describe('removeMicrosoft', () => {
      it('should filter out Microsoft email addresses', () => {
        const contacts = [
          { id: 1, email: 'user@hotmail.com', isValid: true, uuid: 'uuid-1' },
          { id: 2, email: 'user@gmail.com', isValid: true, uuid: 'uuid-2' },
          { id: 3, email: 'user@outlook.com', isValid: true, uuid: 'uuid-3' },
          { id: 4, email: 'user@yahoo.com', isValid: true, uuid: 'uuid-4' },
        ];

        // Mock isMicrosoft to return true for hotmail and outlook
        mailUtils.isMicrosoft = jest.fn().mockImplementation((email) => email.includes('hotmail') || email.includes('outlook'));

        const result = service.removeMicrosoft(contacts);

        // Should keep only non-Microsoft emails
        expect(result).toEqual([
          { id: 2, email: 'user@gmail.com', isValid: true, uuid: 'uuid-2' },
          { id: 4, email: 'user@yahoo.com', isValid: true, uuid: 'uuid-4' },
        ]);
        expect(result.length).toBe(2);
      });

      it('should log debug message for each removed Microsoft email', () => {
        const contacts = [
          { id: 1, email: 'user@hotmail.com', isValid: true, uuid: 'uuid-1' },
          { id: 2, email: 'user@outlook.com', isValid: true, uuid: 'uuid-2' },
        ];

        mailUtils.isMicrosoft = jest.fn().mockReturnValue(true);

        service.removeMicrosoft(contacts);

        // Should log each Microsoft email
        expect(trackerService.logDebug).toHaveBeenCalledWith('Remove microsoft email: user@hotmail.com');
        expect(trackerService.logDebug).toHaveBeenCalledWith('Remove microsoft email: user@outlook.com');
      });

      it('should return all contacts when none are Microsoft emails', () => {
        const contacts = [
          { id: 1, email: 'user@gmail.com', isValid: true, uuid: 'uuid-1' },
          { id: 2, email: 'user@yahoo.com', isValid: true, uuid: 'uuid-2' },
        ];

        mailUtils.isMicrosoft = jest.fn().mockReturnValue(false);

        const result = service.removeMicrosoft(contacts);

        expect(result).toEqual(contacts);
        expect(result.length).toBe(2);
      });
    });

    describe('saveBatchToRedis', () => {
      const createMockBatchForRedis = () =>
        createMockBatch({
          contacts: [
            { id: 1, email: 'user1@example.com', isValid: true, uuid: 'uuid-1' },
            { id: 2, email: 'user2@example.com', isValid: true, uuid: 'uuid-2' },
          ],
          message: {
            ...createMockBatch().message,
            name: 'Test Email',
            ippool: 'test-pool',
          },
        });

      beforeEach(() => {
        redisClient.exists = jest.fn().mockResolvedValue(0);
      });

      it('should save each contact to Redis with 2-hour TTL', async () => {
        const batch = createMockBatchForRedis();

        await service.saveBatchToRedis(batch, 'America/Sao_Paulo', 0);

        // Each contact should be saved with format: {accountId}:{email}:{slugifiedName}
        expect(redisClient.set).toHaveBeenCalledWith('1:user1@example.com:test-email', 'true', 'EX', 7200);
        expect(redisClient.set).toHaveBeenCalledWith('1:user2@example.com:test-email', 'true', 'EX', 7200);
      });

      it('should increment rate limit counter when sendLimitPerUser is set', async () => {
        const batch = createMockBatchForRedis();

        await service.saveBatchToRedis(batch, 'America/Sao_Paulo', 100);

        // Should increment counter for each contact
        expect(redisClient.incr).toHaveBeenCalled();
      });

      it('should NOT increment rate limit counter when sendLimitPerUser is 0', async () => {
        const batch = createMockBatchForRedis();

        await service.saveBatchToRedis(batch, 'America/Sao_Paulo', 0);

        // Should NOT increment when limit is not set
        expect(redisClient.incr).not.toHaveBeenCalled();
      });

      it('should track hourly sent emails by pool', async () => {
        const batch = createMockBatchForRedis();

        await service.saveBatchToRedis(batch, 'America/Sao_Paulo', 0);

        // Should increment hourly counter
        expect(redisClient.incrby).toHaveBeenCalled();
        const hourlyCall = redisClient.incrby.mock.calls.find((call) => call[0].includes('sent-by-hour'));
        expect(hourlyCall[0]).toMatch(/^pool_test-pool:sent-by-hour-\d+$/);
        expect(hourlyCall[1]).toBe(2); // 2 contacts
      });

      it('should track daily sent emails by pool', async () => {
        const batch = createMockBatchForRedis();

        await service.saveBatchToRedis(batch, 'America/Sao_Paulo', 0);

        // Should increment daily counter
        const dailyCall = redisClient.incrby.mock.calls.find((call) => call[0].includes('sent-by-day'));
        expect(dailyCall[0]).toMatch(/^pool_test-pool:sent-by-day-\d{4}-\d{2}-\d{2}$/);
        expect(dailyCall[1]).toBe(2); // 2 contacts
      });

      it('should handle Redis errors gracefully', async () => {
        const batch = createMockBatchForRedis();
        redisClient.set.mockRejectedValue(new Error('Redis connection failed'));

        // Should not throw, just log error
        await expect(service.saveBatchToRedis(batch, 'America/Sao_Paulo', 0)).resolves.not.toThrow();
      });
    });

    describe('sendTracker', () => {
      it('should send tracker event with batch information', async () => {
        const batch = createMockBatch();

        await service.sendTracker('EMAIL_BATCH', batch);

        expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            campaign_id: 123,
            service: 'MSGOPS_SEND_BATCH_EMAIL',
            event: 'EMAIL_BATCH',
            contacts_length: 2,
            email_id: 1,
            email_subject: 'Test Subject',
            page: 1,
            totalPages: 1,
          }),
        );
      });

      it('should include optional data in tracker event', async () => {
        const batch = createMockBatch();
        const responseData = { statusCode: 202, results: { id: 'test-id' } };

        await service.sendTracker('SENT_EMAIL_BATCH', batch, responseData);

        expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'SENT_EMAIL_BATCH',
            data: responseData,
          }),
        );
      });
    });

    describe('automationBatch', () => {
      const createMockAutomationBatch = (overrides = {}): any => ({
        messageId: 'msg-123',
        startedAt: Date.now(),
        automationId: 456,
        automationName: 'Test Automation',
        automationType: 'email' as const,
        isRateLimit: false,
        utmContent: 'test-content',
        utmCampaign: 'test-campaign',
        sendAt: Date.now(),
        contacts: [
          { id: 1, email: 'user1@example.com', isValid: true, uuid: 'uuid-1' },
          { id: 2, email: 'user2@example.com', isValid: true, uuid: 'uuid-2' },
        ],
        message: {
          id: 1,
          title: 'Test Email',
          name: 'test-email',
          ippool: 'default-pool',
          subject: 'Test Subject',
          replyTo: 'reply@example.com',
          priority: 'normal',
          content: '<p>Test content</p>',
          location: {
            bucketName: 'test-bucket',
            fileName: 'test-file.html',
          },
          from: {
            firstName: 'Sender',
            email: 'sender@example.com',
          },
        },
        next: { pubName: '', data: {} as any },
        account: {
          id: 1,
          name: 'Test Account',
          accountConfigs: [{ accountId: 1, name: 'time_zone', value: 'America/Sao_Paulo' }],
        },
        ...overrides,
      });

      it('should process automation batch successfully', async () => {
        const mockBatch = createMockAutomationBatch();

        const result = await service.automationBatch(mockBatch, null);

        expect(result).toEqual([{ statusCode: 202, results: { id: 'test-id' } }]);
        expect(mailService.sendBatch).toHaveBeenCalledWith(mockBatch, null);
      });

      it('should apply contact cleanup filters', async () => {
        const mockBatch = createMockAutomationBatch();
        redisClient.mget.mockResolvedValue([null, null]); // All clean

        await service.automationBatch(mockBatch, null);

        // Should call cleanupContacts for each category
        expect(redisClient.mget).toHaveBeenCalled();
      });

      it('should return status false when contacts array is empty after cleanup', async () => {
        const mockBatch = createMockAutomationBatch();
        redisClient.mget.mockResolvedValue(['true', 'true']); // All blocked

        const result = await service.automationBatch(mockBatch, null);

        expect(result).toEqual({ status: false });
        expect(mailService.sendBatch).not.toHaveBeenCalled();
      });

      it('should remove Microsoft emails for account ID 1 when ippool is NOT m02_brmailsrv_com', async () => {
        const mockBatch = createMockAutomationBatch({
          account: { id: 1, accountConfigs: [] },
          message: {
            ...createMockAutomationBatch().message,
            ippool: 'other-pool',
          },
        });

        mailUtils.isMicrosoft = jest.fn().mockReturnValue(false);

        await service.automationBatch(mockBatch, null);

        // Should check for Microsoft emails
        expect(mailUtils.isMicrosoft).toHaveBeenCalled();
      });

      it('should NOT remove Microsoft emails when ippool is m02_brmailsrv_com', async () => {
        const mockBatch = createMockAutomationBatch({
          account: { id: 1, accountConfigs: [] },
          message: {
            ...createMockAutomationBatch().message,
            ippool: 'm02_brmailsrv_com',
          },
        });

        mailUtils.isMicrosoft = jest.fn().mockReturnValue(true);

        await service.automationBatch(mockBatch, null);

        // Should NOT filter when ippool matches
        expect(mailUtils.isMicrosoft).not.toHaveBeenCalled();
      });
    });

    describe('validateAutomationBatch', () => {
      const createValidAutomationBatch = () =>
        ({
          messageId: 'msg-123',
          contacts: [{ id: 1, email: 'test@example.com', isValid: true, uuid: 'uuid-1' }],
          message: {
            subject: 'Test Subject',
            content: '<p>Test</p>',
            location: { bucketName: 'bucket', fileName: 'file.html' },
            from: { email: 'sender@example.com', firstName: 'Sender' },
          },
        }) as any;

      it('should throw BadRequestException when contacts is missing', () => {
        const batch = { ...createValidAutomationBatch(), contacts: undefined };

        expect(() => service.validateAutomationBatch(batch)).toThrow(BadRequestException);
        expect(() => service.validateAutomationBatch(batch)).toThrow('Need contacts to send email');
      });

      it('should throw BadRequestException when contacts exceed limit', () => {
        process.env.LIMIT_CONTACT_BATCH = '5';
        const batch = {
          ...createValidAutomationBatch(),
          contacts: Array.from({ length: 10 }, (_, i) => ({ id: i, email: `test${i}@example.com`, isValid: true, uuid: `uuid-${i}` })),
        };

        expect(() => service.validateAutomationBatch(batch)).toThrow(BadRequestException);
        expect(() => service.validateAutomationBatch(batch)).toThrow('Limit of contacts per batch was exceeded');
      });

      it('should throw BadRequestException when message.subject is missing', () => {
        const batch = createValidAutomationBatch();
        batch.message.subject = null;

        expect(() => service.validateAutomationBatch(batch)).toThrow(BadRequestException);
      });

      it('should throw BadRequestException when message.from.email is missing', () => {
        const batch = createValidAutomationBatch();
        batch.message.from.email = null;

        expect(() => service.validateAutomationBatch(batch)).toThrow(BadRequestException);
      });

      it('should throw BadRequestException when content AND location are missing', () => {
        const batch = createValidAutomationBatch();
        batch.message.content = null;
        batch.message.location.fileName = null;
        batch.message.location.bucketName = null;

        expect(() => service.validateAutomationBatch(batch)).toThrow(BadRequestException);
        expect(() => service.validateAutomationBatch(batch)).toThrow('Email must contain location object');
      });

      it('should validate successfully when all required fields are present', () => {
        const batch = createValidAutomationBatch();

        expect(() => service.validateAutomationBatch(batch)).not.toThrow();
      });
    });

    describe('utility methods', () => {
      describe('getRedis', () => {
        it('should retrieve and parse JSON from Redis using getdel', async () => {
          const mockPayload = { foo: 'bar', count: 123 };
          redisClient.getdel = jest.fn().mockResolvedValue(JSON.stringify(mockPayload));

          const result = await service.getRedis('test-key');

          expect(redisClient.getdel).toHaveBeenCalledWith('test-key');
          expect(result).toEqual(mockPayload);
        });
      });

      describe('setRedis', () => {
        it('should stringify and save payload to Redis with 12-hour TTL', async () => {
          const mockPayload = { foo: 'bar', count: 123 };

          await service.setRedis('test-key', mockPayload);

          expect(redisClient.set).toHaveBeenCalledWith('test-key', JSON.stringify(mockPayload), 'EX', 43200);
        });
      });

      describe('setPubsubErros', () => {
        it('should send error payload via PubSub', async () => {
          const mockPayload = { error: 'Something failed', timestamp: Date.now() };

          await service.setPubsubErros(mockPayload);

          expect(pubSubProvider.sendAsyncMessage2).toHaveBeenCalledWith(mockPayload);
        });
      });
    });
  });
});
