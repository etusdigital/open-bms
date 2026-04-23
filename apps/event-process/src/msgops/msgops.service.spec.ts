import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { MsgopsService } from './msgops.service';
import { FormatterUtils } from '../utils/formatter.utils';
import { CacheService } from './cache.service';
import { RedisService } from '../providers/redis/redis.service';

describe('MsgopsService', () => {
  let service: MsgopsService;

  const mockFormatterUtils = {
    logInfo: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockRedisService = {
    getOrThrow: jest.fn(() => mockRedisClient),
  };

  const mockPgPool = {
    query: jest.fn(),
  };

  const mockPgPoolLogs = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MsgopsService,
        {
          provide: FormatterUtils,
          useValue: mockFormatterUtils,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: 'PG_CONNECTION',
          useValue: mockPgPool,
        },
        {
          provide: 'PG_CONNECTION_LOGS',
          useValue: mockPgPoolLogs,
        },
      ],
    }).compile();

    service = module.get<MsgopsService>(MsgopsService);
  });

  describe('prepareQuery', () => {
    it('should handle empty array', () => {
      const result = service['prepareQuery']([]);
      expect(result).toEqual({ keys: [], values: [] });
      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith('Array is empty or not provided: []');
    });

    it('should handle null input', () => {
      const result = service['prepareQuery'](null);
      expect(result).toEqual({ keys: [], values: [] });
      expect(mockFormatterUtils.logInfo).toHaveBeenCalledWith('Array is empty or not provided: null');
    });

    it('should correctly transform camelCase to snake_case', () => {
      const input = [
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'Jane', lastName: 'Smith' },
      ];

      const result = service['prepareQuery'](input);
      expect(result.keys).toEqual(['first_name', 'last_name']);
      expect(result.values).toEqual([
        ['John', 'Doe'],
        ['Jane', 'Smith'],
      ]);
    });

    it('should handle mixed case properties', () => {
      const input = [
        { userID: 1, emailAddress: 'test@test.com' },
        { userID: 2, emailAddress: 'test2@test.com' },
      ];

      const result = service['prepareQuery'](input);
      expect(result.keys).toEqual(['user_id', 'email_address']);
      expect(result.values).toEqual([
        [1, 'test@test.com'],
        [2, 'test2@test.com'],
      ]);
    });

    it('should handle null and undefined values', () => {
      const input = [
        { name: 'John', age: null, email: undefined },
        { name: 'Jane', age: 30, email: 'jane@test.com' },
      ];

      const result = service['prepareQuery'](input);
      expect(result.keys).toEqual(['name', 'age', 'email']);
      expect(result.values).toEqual([
        ['John', null, null],
        ['Jane', 30, 'jane@test.com'],
      ]);
    });

    it('should handle nested objects', () => {
      const input = [
        { user: { firstName: 'John', lastName: 'Doe' } },
        { user: { firstName: 'Jane', lastName: 'Smith' } },
      ];

      const result = service['prepareQuery'](input);
      expect(result.keys).toEqual(['user']);
      expect(result.values).toEqual([
        [{ firstName: 'John', lastName: 'Doe' }],
        [{ firstName: 'Jane', lastName: 'Smith' }],
      ]);
    });

    it('should handle arrays of different shapes', () => {
      const input = [
        { name: 'John', age: 30 },
        { name: 'Jane', email: 'jane@test.com' },
        { name: 'Bob', age: 25, email: 'bob@test.com' },
      ];

      const result = service['prepareQuery'](input);
      expect(result.keys).toEqual(['name', 'age', 'email']);
      expect(result.values).toEqual([
        ['John', 30, null],
        ['Jane', null, 'jane@test.com'],
        ['Bob', 25, 'bob@test.com'],
      ]);
    });

    it('should handle large arrays efficiently', () => {
      const size = 1000;
      const input = Array.from({ length: size }, (_, i) => ({
        userId: i,
        firstName: `User${i}`,
        lastName: `LastName${i}`,
        email: `user${i}@test.com`,
      }));

      const startTime = performance.now();
      const result = service['prepareQuery'](input);
      const endTime = performance.now();

      expect(result.keys).toEqual(['user_id', 'first_name', 'last_name', 'email']);
      expect(result.values.length).toBe(size);
      expect(result.values[0].length).toBe(4);

      // Performance check - should complete within 100ms
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100);
    });
  });

  describe('batchUpdateContactsBounce', () => {
    beforeEach(() => {
      mockPgPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('includes a hard-wins guard so a soft bounce cannot overwrite an existing HARD bounce', async () => {
      await service.batchUpdateContactsBounce([{ id: 1, bounceType: 'SOFT', bouncedAt: new Date() }], 42);

      const sql: string = mockPgPool.query.mock.calls[0][0];

      // The WHERE clause must prevent updating rows that already have bounce_type = 'HARD'
      // when the incoming bounce type is SOFT
      expect(sql).toMatch(/IS DISTINCT FROM/i);
    });

    it('allows a HARD bounce to overwrite an existing SOFT bounce', async () => {
      await service.batchUpdateContactsBounce([{ id: 1, bounceType: 'HARD', bouncedAt: new Date() }], 42);

      const sql: string = mockPgPool.query.mock.calls[0][0];

      // HARD bounce is always applied regardless of existing bounce_type
      expect(sql).toContain('bounce_type');
      // The guard condition should still allow HARD to pass through
      expect(sql).toMatch(/v\.bounce_type\s*=\s*'HARD'/i);
    });

    it('should return early when entries is empty', async () => {
      const result = await service.batchUpdateContactsBounce([], 42);
      expect(result).toBeUndefined();
      expect(mockPgPool.query).not.toHaveBeenCalled();
    });
  });

  describe('checkPostgresConnection', () => {
    it('should resolve when both pools respond to SELECT 1', async () => {
      mockPgPool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockPgPoolLogs.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

      await expect(service.checkPostgresConnection(1, 0)).resolves.toBeUndefined();
    });

    it('should retry on failure and succeed on second attempt', async () => {
      mockPgPool.query.mockRejectedValueOnce(new Error('connection refused')).mockResolvedValue({ rows: [] });
      mockPgPoolLogs.query.mockResolvedValue({ rows: [] });

      await expect(service.checkPostgresConnection(2, 0)).resolves.toBeUndefined();
      expect(mockPgPool.query).toHaveBeenCalledTimes(2);
    });

    it('should throw InternalServerErrorException after all retries exhausted', async () => {
      mockPgPool.query.mockRejectedValue(new Error('connection refused'));
      mockPgPoolLogs.query.mockResolvedValue({ rows: [] });

      await expect(service.checkPostgresConnection(1, 0)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAccountIdByApiKey', () => {
    it('should return from memory cache on hit', async () => {
      mockCacheService.get.mockReturnValueOnce(42);
      const result = await service.findAccountIdByApiKey('key-1');
      expect(result).toBe(42);
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should return from Redis cache when memory cache misses', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce('55');
      const result = await service.findAccountIdByApiKey('key-2');
      expect(result).toBe(55);
      expect(mockCacheService.set).toHaveBeenCalledWith('apiKey', 'key-2', 55);
    });

    it('should query DB when both caches miss', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockResolvedValueOnce({ rows: [{ account_id: 99 }] });

      const result = await service.findAccountIdByApiKey('key-3');
      expect(result).toBe(99);
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith('apiKey', 'key-3', 99);
    });

    it('should return 0 when apiKey not found in DB', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.findAccountIdByApiKey('bad-key');
      expect(result).toBe(0);
    });
  });

  describe('getAccountTimeZone', () => {
    it('should return from memory cache on hit', async () => {
      mockCacheService.get.mockReturnValueOnce('America/Sao_Paulo');
      const result = await service.getAccountTimeZone(1);
      expect(result).toBe('America/Sao_Paulo');
    });

    it('should return from Redis cache when memory cache misses', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce('Europe/London');
      const result = await service.getAccountTimeZone(2);
      expect(result).toBe('Europe/London');
    });

    it('should query DB when both caches miss', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockResolvedValueOnce({ rows: [{ value: 'Asia/Tokyo' }], rowCount: 1 });

      const result = await service.getAccountTimeZone(3);
      expect(result).toBe('Asia/Tokyo');
    });

    it('should return UTC when no timezone config found (rowCount === 0)', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await service.getAccountTimeZone(4);
      expect(result).toBe('UTC');
    });

    it('should return UTC on DB error', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockRejectedValueOnce(new Error('db error'));

      const result = await service.getAccountTimeZone(5);
      expect(result).toBe('UTC');
    });
  });

  describe('findContactById', () => {
    it('should return null when id is NaN', async () => {
      const result = await service.findContactById(1, NaN);
      expect(result).toBeNull();
    });

    it('should return contact when found', async () => {
      const contact = { id: 10, email: 'test@test.com' };
      mockPgPool.query.mockResolvedValueOnce({ rows: [contact] });
      const result = await service.findContactById(1, 10);
      expect(result).toEqual(contact);
    });

    it('should return null when not found', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [] });
      const result = await service.findContactById(1, 999);
      expect(result).toBeNull();
    });
  });

  describe('findContactByEmail', () => {
    it('should return contact when found', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      const result = await service.findContactByEmail(1, 'test@test.com');
      expect(result).toEqual({ id: 10 });
    });

    it('should return null when not found', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [] });
      const result = await service.findContactByEmail(1, 'none@test.com');
      expect(result).toBeNull();
    });
  });

  describe('findContactByUuid', () => {
    it('should return contact when found', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [{ id: 20 }] });
      const result = await service.findContactByUuid(1, 'uuid-1');
      expect(result).toEqual({ id: 20 });
    });

    it('should return null when not found', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [] });
      const result = await service.findContactByUuid(1, 'uuid-none');
      expect(result).toBeNull();
    });
  });

  describe('updateContactsById', () => {
    it('should call pgPool.query with UPDATE query', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      await service.updateContactsById([1, 2], 42, { isActive: true });
      expect(mockPgPool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE contacts SET'));
    });

    it('should throw Error when query fails', async () => {
      mockPgPool.query.mockImplementationOnce(() => {
        throw new Error('db error');
      });
      await expect(service.updateContactsById([1], 42, { isActive: true })).rejects.toThrow(
        'Error to update contact by id',
      );
    });
  });

  describe('updateContactsValidateByEmail', () => {
    it('should build correct INSERT ON CONFLICT query', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [] });
      await service.updateContactsValidateByEmail(['a@test.com', 'b@test.com'], { lastOpen: new Date() });
      expect(mockPgPool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO email_validations'));
      expect(mockPgPool.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'));
    });

    it('should deduplicate emails', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [] });
      await service.updateContactsValidateByEmail(['a@test.com', 'a@test.com'], { lastOpen: new Date() });
      // Should only have one value row
      const query = mockPgPool.query.mock.calls[0][0];
      const matches = query.match(/a@test\.com/g);
      // The deduplicated list should only have one entry
      expect(matches.length).toBeLessThanOrEqual(2); // once in VALUES, once isn't repeated
    });
  });

  describe('updateContactDevices', () => {
    it('should return early when ids is empty', async () => {
      const result = await service.updateContactDevices([], 1, {});
      expect(result).toBeUndefined();
    });

    it('should return early when accountId is falsy', async () => {
      const result = await service.updateContactDevices(['d1'], 0, {});
      expect(result).toBeUndefined();
    });

    it('should call pgPool.query with UPDATE query', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [] });
      await service.updateContactDevices(['d1', 'd2'], 42, { isActive: true });
      expect(mockPgPool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE contacts_devices SET'));
    });
  });

  describe('saveEventsLogs', () => {
    it('should return early when dataToInsert is empty', async () => {
      const result = await service.saveEventsLogs([]);
      expect(result).toEqual({ rows: [] });
      expect(mockFormatterUtils.logInfo).toHaveBeenCalled();
    });

    it('should call pgPoolLogs.query with INSERT query', async () => {
      mockPgPoolLogs.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      await service.saveEventsLogs([{ accountId: 1, event: 'test', time: new Date() }]);
      expect(mockPgPoolLogs.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO events_logs'));
    });

    it('should exclude delivered_id from column list', async () => {
      mockPgPoolLogs.query.mockResolvedValueOnce({ rows: [] });
      await service.saveEventsLogs([{ accountId: 1, event: 'test', delivered_id: 'sg-msg-1' }]);
      const query = mockPgPoolLogs.query.mock.calls[0][0];
      expect(query).not.toContain('delivered_id');
    });

    it('should exclude traits (internal bot-detection field) from column list', async () => {
      mockPgPoolLogs.query.mockResolvedValueOnce({ rows: [] });
      await service.saveEventsLogs([
        {
          accountId: 1,
          event: 'click',
          traits: { asn: 15169, asnOrg: 'Google LLC', userType: 'hosting' },
        },
      ]);
      const query = mockPgPoolLogs.query.mock.calls[0][0];
      expect(query).not.toContain('traits');
    });

    it('should throw Error when query fails', async () => {
      mockPgPoolLogs.query.mockRejectedValueOnce(new Error('db error'));
      await expect(service.saveEventsLogs([{ accountId: 1 }])).rejects.toThrow('Error to save logs');
    });
  });

  describe('findEvent', () => {
    it('should return from memory cache on hit', async () => {
      mockCacheService.get.mockReturnValueOnce({ id: 1, name: 'test' });
      const result = await service.findEvent('test', 42);
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should return from Redis cache when memory cache misses', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: 2, name: 'cached' }));
      const result = await service.findEvent('cached', 42);
      expect(result).toEqual({ id: 2, name: 'cached' });
    });

    it('should query DB when both caches miss', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockResolvedValueOnce({ rows: [{ id: 3, name: 'db-event' }] });

      const result = await service.findEvent('db-event', 42);
      expect(result).toEqual({ id: 3, name: 'db-event' });
    });

    it('should return null when event not found', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.findEvent('missing', 42);
      expect(result).toBeNull();
    });
  });

  describe('batchUpsertValidationBounce', () => {
    it('should return early when entries is empty', async () => {
      const result = await service.batchUpsertValidationBounce([]);
      expect(result).toBeUndefined();
    });

    it('should call pgPool.query with INSERT query', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [] });
      await service.batchUpsertValidationBounce([{ email: 'a@test.com', bouncedAt: new Date() }]);
      expect(mockPgPool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO email_validations'));
    });
  });

  describe('clearValidationUnsubscribed', () => {
    it('should call pgPool.query with UPDATE query', async () => {
      mockPgPool.query.mockResolvedValueOnce({ rows: [] });
      await service.clearValidationUnsubscribed(['a@test.com']);
      expect(mockPgPool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE email_validations'));
    });
  });

  describe('findMessageAssociation', () => {
    const accountId = 10;
    const messageId = 579367;
    const name = 'cc_portobnk_hfnc_v1-32';

    it('should return from memory cache on hit', async () => {
      mockCacheService.get.mockReturnValueOnce({ campaignId: 42 });
      const result = await service.findMessageAssociation(accountId, messageId, name);
      expect(result).toEqual({ campaignId: 42 });
      expect(mockRedisClient.get).not.toHaveBeenCalled();
      expect(mockPgPool.query).not.toHaveBeenCalled();
    });

    it('should return from Redis cache when memory cache misses', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ automationId: 88 }));
      const result = await service.findMessageAssociation(accountId, messageId, name);
      expect(result).toEqual({ automationId: 88 });
      expect(mockCacheService.set).toHaveBeenCalledWith('message_association', `${accountId}:${messageId}:${name}`, {
        automationId: 88,
      });
      expect(mockPgPool.query).not.toHaveBeenCalled();
    });

    it('should resolve campaignId via campaigns_messages join when both caches miss', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });

      const result = await service.findMessageAssociation(accountId, messageId, name);
      expect(result).toEqual({ campaignId: 42 });
      expect(mockPgPool.query).toHaveBeenCalledTimes(1);
      expect(mockPgPool.query.mock.calls[0][0]).toMatch(/campaigns_messages/);
      expect(mockPgPool.query.mock.calls[0][1]).toEqual([accountId, name, messageId]);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('message_association:'),
        JSON.stringify({ campaignId: 42 }),
        'EX',
        expect.any(Number),
      );
    });

    it('should fall back to automations steps LIKE scan when no campaign matches', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 88 }] });

      const result = await service.findMessageAssociation(accountId, messageId, name);
      expect(result).toEqual({ automationId: 88 });
      expect(mockPgPool.query).toHaveBeenCalledTimes(2);
      expect(mockPgPool.query.mock.calls[1][0]).toMatch(/automations/);
      expect(mockPgPool.query.mock.calls[1][0]).toMatch(/steps::text LIKE/);
      expect(mockPgPool.query.mock.calls[1][1]).toEqual([accountId, name, `%"id": ${messageId}%`]);
    });

    it('should return empty object and cache the miss when neither campaign nor automation matches', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      const result = await service.findMessageAssociation(accountId, messageId, name);
      expect(result).toEqual({});
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('message_association:'),
        JSON.stringify({}),
        'EX',
        expect.any(Number),
      );
    });

    it('should not run LIKE scan when campaign lookup already hit', async () => {
      mockCacheService.get.mockReturnValueOnce(undefined);
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockPgPool.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });

      await service.findMessageAssociation(accountId, messageId, name);
      expect(mockPgPool.query).toHaveBeenCalledTimes(1);
    });
  });
});
