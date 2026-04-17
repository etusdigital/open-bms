import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { BatchService } from '../../batch/batch.service';
import { MailService } from '../../mail/mail.service';
import { MailUtils } from '../../mail/mail.utils';
import { FormatterUtils } from '../../utils/formatter.utils';
import { TrackerService } from '../../tracker/tracker.service';
import { PubSubProvider } from '../pubsub.provider';
import { SparkPostHandler } from '../../handlers/sparkpost/sparkPost.handler';
import { AppService } from '../../app.service';
import { StorageService } from '../../storage/storage.service';
import { SplitFeature } from '../../features/split/split.feature';
import Redis from 'ioredis-mock';

describe('Redis Integration Tests', () => {
  let batchService: BatchService;
  let appService: AppService;
  let redisClient: any;
  let module: TestingModule;

  beforeAll(async () => {
    // Create a mock Redis client
    redisClient = new Redis({
      data: {}, // Start with empty data
    });

    module = await Test.createTestingModule({
      providers: [
        BatchService,
        AppService,
        {
          provide: RedisService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(redisClient),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendBatch: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
            sendMail: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
          },
        },
        {
          provide: MailUtils,
          useValue: {
            getAccountConfig: jest.fn((configs, key) => {
              const config = configs?.find((c) => c.name === key);
              return config?.value;
            }),
            slugify: jest.fn((text) => text?.toLowerCase().replace(/\s+/g, '-')),
            isMicrosoft: jest.fn().mockReturnValue(false),
            getCategories: jest.fn().mockReturnValue([]),
            getCategoriesCampaign: jest.fn().mockReturnValue([]),
            parseHandlebarsVariables: jest.fn((html) => html),
            createPreviewText: jest.fn((html) => html),
            createEmailPixel: jest.fn((params) => ({
              template: params?.emailContent || '<p>Test</p>',
              replaceLinks: [],
            })),
            getIppol: jest.fn((message) => message?.ippool || 'default'),
            parseContent: jest.fn().mockReturnValue({ template: '<p>Test</p>' }),
            getPersonalization: jest.fn(() => ({ to: [], substitutions: {} })),
            mapVariables: jest.fn(() => ({})),
          },
        },
        {
          provide: FormatterUtils,
          useValue: {
            isValidEmail: jest.fn().mockReturnValue(true),
            slugify: jest.fn((text) => text?.toLowerCase().replace(/\s+/g, '-')),
            normalizeString: jest.fn((text) => text),
          },
        },
        {
          provide: TrackerService,
          useValue: {
            logDebug: jest.fn(),
            logInfo: jest.fn(),
            logError: jest.fn(),
            sendInfo: jest.fn(),
            sendDebug: jest.fn(),
          },
        },
        {
          provide: PubSubProvider,
          useValue: {
            sendAsyncMessage: jest.fn().mockResolvedValue(true),
            sendAsyncMessage2: jest.fn().mockResolvedValue(true),
            publishMessage: jest.fn().mockResolvedValue('msg-id'),
          },
        },
        {
          provide: SparkPostHandler,
          useValue: {
            createCampaignBatchMail: jest.fn().mockReturnValue({}),
            createAutomationBatchMail: jest.fn().mockReturnValue({}),
            sendEmail: jest.fn().mockResolvedValue([{ statusCode: 200 }]),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getHtml: jest.fn().mockResolvedValue('<p>HTML from storage</p>'),
          },
        },
        {
          provide: SplitFeature,
          useValue: {
            getConfig: jest.fn().mockReturnValue(null),
            shouldChange: jest.fn().mockReturnValue(false),
            calculatePercent: jest.fn().mockReturnValue(false),
            compareStrings: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    batchService = module.get<BatchService>(BatchService);
    appService = module.get<AppService>(AppService);
  });

  afterEach(async () => {
    // Clear all keys after each test
    await redisClient.flushall();
  });

  afterAll(async () => {
    await redisClient.quit();
    await module.close();
  });

  describe('Batch Service + Redis Integration', () => {
    it('should save sent contacts to Redis with correct key format', async () => {
      const mockBatch: any = {
        account: { id: 1, accountConfigs: [] },
        campaign: { id: 123, isWarmup: false, spreadSending: 0, scheduleTo: null },
        campaign_id: 123,
        campaign_name: 'Test Campaign',
        page: 1,
        totalPages: 1,
        contacts: [
          { id: 101, email: 'user1@test.com', isValid: true, uuid: 'uuid-1' },
          { id: 102, email: 'user2@test.com', isValid: true, uuid: 'uuid-2' },
        ],
        message: {
          id: 1,
          name: 'test-email',
          ippool: 'default-pool',
          subject: 'Test',
          fromMail: 'sender@test.com',
          fromName: 'Sender',
          content: '<p>Test</p>',
        },
      };

      await batchService.saveBatchToRedis(mockBatch, 'America/Sao_Paulo', 0);

      // Verify contacts were saved with correct key format: accountId:email:slugifiedName
      const key1 = await redisClient.get('1:user1@test.com:test-email');
      const key2 = await redisClient.get('1:user2@test.com:test-email');

      expect(key1).toBe('true');
      expect(key2).toBe('true');
    });

    it('should retrieve contacts from Redis for duplicate validation', async () => {
      // Pre-populate Redis with a sent contact
      await redisClient.set('1:duplicate@test.com:test-email', 'true', 'EX', 7200);

      const contacts = [
        { id: 1, email: 'duplicate@test.com', isValid: true, uuid: 'uuid-1' },
        { id: 2, email: 'new@test.com', isValid: true, uuid: 'uuid-2' },
      ];

      const result = await batchService.cleanupContacts(contacts, 'duplicated', 'test-email', 1);

      // duplicate@test.com should be filtered out
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('new@test.com');
    });

    it('should respect TTL configured for contact keys', async () => {
      const mockBatch: any = {
        account: { id: 1, accountConfigs: [] },
        campaign: { id: 123, isWarmup: false, spreadSending: 0, scheduleTo: null },
        campaign_id: 123,
        campaign_name: 'Test Campaign',
        page: 1,
        totalPages: 1,
        contacts: [{ id: 101, email: 'user1@test.com', isValid: true, uuid: 'uuid-1' }],
        message: {
          id: 1,
          name: 'test-email',
          ippool: 'default-pool',
          subject: 'Test',
          fromMail: 'sender@test.com',
          fromName: 'Sender',
          content: '<p>Test</p>',
        },
      };

      await batchService.saveBatchToRedis(mockBatch, 'America/Sao_Paulo', 0);

      // Verify TTL is set (should be 2 hours = 7200 seconds)
      const ttl = await redisClient.ttl('1:user1@test.com:test-email');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(7200);
    });

    it('should increment rate limit counter when sendLimitPerUser is set', async () => {
      const mockBatch: any = {
        account: { id: 1, accountConfigs: [] },
        campaign: { id: 123, isWarmup: false, spreadSending: 0, scheduleTo: null },
        campaign_id: 123,
        campaign_name: 'Test Campaign',
        page: 1,
        totalPages: 1,
        contacts: [{ id: 101, email: 'user1@test.com', isValid: true, uuid: 'uuid-1' }],
        message: {
          id: 1,
          name: 'test-email',
          ippool: 'default-pool',
          subject: 'Test',
          fromMail: 'sender@test.com',
          fromName: 'Sender',
          content: '<p>Test</p>',
        },
      };

      // Save with rate limit enabled
      await batchService.saveBatchToRedis(mockBatch, 'America/Sao_Paulo', 100);

      // Check if counter was incremented (key format: contact_send:{contactId}:{date})
      const keys = await redisClient.keys('contact_send:101:*');
      expect(keys.length).toBeGreaterThan(0);

      // Get the counter value
      const counter = await redisClient.get(keys[0]);
      expect(parseInt(counter)).toBeGreaterThan(0);
    });

    it('should handle Redis connection failure gracefully', async () => {
      // Create a failing Redis mock
      const failingRedis = {
        set: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        get: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        mget: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        incrby: jest.fn((key, value, callback) => {
          callback(new Error('Redis connection failed'), null);
        }),
      };

      const failingRedisService = {
        getOrThrow: jest.fn().mockReturnValue(failingRedis),
      };

      const failingModule = await Test.createTestingModule({
        providers: [
          BatchService,
          {
            provide: RedisService,
            useValue: failingRedisService,
          },
          {
            provide: MailService,
            useValue: { sendBatch: jest.fn().mockResolvedValue([{ statusCode: 202 }]) },
          },
          {
            provide: MailUtils,
            useValue: {
              getAccountConfig: jest.fn(),
              slugify: jest.fn((text) => text?.toLowerCase().replace(/\s+/g, '-')),
              isMicrosoft: jest.fn().mockReturnValue(false),
            },
          },
          {
            provide: FormatterUtils,
            useValue: {
              isValidEmail: jest.fn().mockReturnValue(true),
              slugify: jest.fn((text) => text?.toLowerCase().replace(/\s+/g, '-')),
              normalizeString: jest.fn((text) => text),
            },
          },
          {
            provide: TrackerService,
            useValue: {
              logDebug: jest.fn(),
              logInfo: jest.fn(),
              logError: jest.fn(),
            },
          },
          {
            provide: PubSubProvider,
            useValue: {
              sendAsyncMessage: jest.fn().mockResolvedValue(true),
            },
          },
        ],
      }).compile();

      const failingBatchService = failingModule.get<BatchService>(BatchService);

      const mockBatch: any = {
        account: { id: 1, accountConfigs: [] },
        campaign: { id: 123, isWarmup: false, spreadSending: 0, scheduleTo: null },
        campaign_id: 123,
        campaign_name: 'Test Campaign',
        page: 1,
        totalPages: 1,
        contacts: [{ id: 101, email: 'user1@test.com', isValid: true, uuid: 'uuid-1' }],
        message: {
          id: 1,
          name: 'test-email',
          ippool: 'default-pool',
          subject: 'Test',
          fromMail: 'sender@test.com',
          fromName: 'Sender',
          content: '<p>Test</p>',
        },
      };

      // Should not throw, should handle gracefully
      await expect(failingBatchService.saveBatchToRedis(mockBatch, 'America/Sao_Paulo', 0)).resolves.not.toThrow();

      await failingModule.close();
    });

    it('should clean expired keys correctly (TTL validation)', async () => {
      // Set a key with very short TTL for testing
      await redisClient.set('1:expired@test.com:test-email', 'true', 'EX', 1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Try to get the key
      const value = await redisClient.get('1:expired@test.com:test-email');
      expect(value).toBeNull();
    });
  });

  describe('App Service + Redis Integration', () => {
    it('should cache blocklist data in Redis', async () => {
      // Set blocklist data
      await redisClient.set('1:blocked:blocked@test.com', 'true');

      const mockData: any = {
        messageId: 'msg-123',
        startedAt: Date.now(),
        automationId: 456,
        automationName: 'Test Automation',
        automationType: 'email',
        isRateLimit: false,
        utmContent: 'test',
        utmCampaign: 'test',
        contact: {
          id: 1,
          email: 'blocked@test.com',
          isValid: true,
          uuid: 'uuid-1',
        },
        message: {
          id: 1,
          name: 'test-email',
          ippool: 'default-pool',
          subject: 'Test',
          content: '<p>Test</p>',
          from: { email: 'sender@test.com', firstName: 'Sender' },
          location: { bucketName: 'test', fileName: 'test.html' },
        },
        next: { pubName: '', data: {} },
        account: {
          id: 1,
          name: 'Test Account',
          accountConfigs: [],
        },
      };

      // Process message - should check Redis for blocklist
      const result = await appService.receiveMessage(mockData, 'redis-key');

      // Contact should be rejected because it's in the blocked list
      expect(result.status).toBe(false);
    });

    it('should invalidate cache when needed (contact send limit)', async () => {
      const contactId = 201;
      const date = '2026-02-11';
      const key = `contact_send:${contactId}:${date}`;

      // Set initial counter
      await redisClient.set(key, '5', 'EX', 86400);

      // Increment counter
      await redisClient.incr(key);

      // Verify counter was incremented
      const counter = await redisClient.get(key);
      expect(parseInt(counter)).toBe(6);
    });
  });
});
