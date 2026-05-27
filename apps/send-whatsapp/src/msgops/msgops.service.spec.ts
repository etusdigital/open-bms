import { Test, TestingModule } from '@nestjs/testing';
import { MsgopsService } from './msgops.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShortLinkEntity } from './entities/short-link.entity';
import { RedisService } from '../providers/redis/redis.service';

describe('MsgopsService', () => {
  let service: MsgopsService;

  const mockRedisClient = {
    set: jest.fn().mockResolvedValue('OK'),
  };

  const mockRedisService = {
    getOrThrow: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockQueryBuilder = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    onConflict: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MsgopsService, { provide: getRepositoryToken(ShortLinkEntity), useValue: mockRepository }, { provide: RedisService, useValue: mockRedisService }],
    }).compile();

    service = module.get<MsgopsService>(MsgopsService);
    jest.clearAllMocks();

    // Re-setup default mock returns after clearAllMocks
    mockRedisService.getOrThrow.mockReturnValue(mockRedisClient);
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.insert.mockReturnThis();
    mockQueryBuilder.values.mockReturnThis();
    mockQueryBuilder.onConflict.mockReturnThis();
    mockQueryBuilder.returning.mockReturnThis();
  });

  describe('generateShortCode', () => {
    it('should return a 6-character string', () => {
      const code = service.generateShortCode();
      expect(code).toHaveLength(6);
    });

    it('should only contain alphanumeric characters', () => {
      const code = service.generateShortCode();
      expect(code).toMatch(/^[A-Za-z0-9]{6}$/);
    });

    it('should generate different codes on multiple calls', () => {
      const codes = new Set(Array.from({ length: 10 }, () => service.generateShortCode()));
      // With 62^6 possibilities, 10 codes should all be unique (extremely high probability)
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe('createRedisKey', () => {
    it('should set a Redis key with 7-day expiry', async () => {
      const shortLink = { short_code: 'abc123', long_url: 'https://example.com/long' };
      await service.createRedisKey(shortLink);

      expect(mockRedisService.getOrThrow).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'redirect_short_link:abc123',
        'https://example.com/long',
        'EX',
        604800, // 7 days in seconds
      );
    });
  });

  describe('createShortLink', () => {
    it('should return undefined in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const result = await service.createShortLink('https://example.com', 'https://base.com/');
      expect(result).toBeUndefined();
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should create short link and cache in Redis when not in test env', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockQueryBuilder.execute.mockResolvedValue({
        raw: [{ short_code: 'xyz789', long_url: 'https://example.com' }],
      });

      const result = await service.createShortLink('https://example.com', 'https://base.com/');

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('short_links');
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(mockQueryBuilder.values).toHaveBeenCalledWith(expect.objectContaining({ longUrl: 'https://example.com' }));
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(result).toBe('https://base.com/xyz789');

      process.env.NODE_ENV = originalEnv;
    });

    it('should retry on short code conflict (empty raw result)', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // First call returns empty (conflict), second returns success
      mockQueryBuilder.execute.mockResolvedValueOnce({ raw: [] }).mockResolvedValueOnce({ raw: [{ short_code: 'retry1', long_url: 'https://example.com' }] });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await service.createShortLink('https://example.com', 'https://base.com/');

      expect(consoleSpy).toHaveBeenCalledWith('[CONFLICT] - DUPLICTED SHORT CODE.');
      expect(result).toBe('https://base.com/retry1');
      consoleSpy.mockRestore();

      process.env.NODE_ENV = originalEnv;
    });
  });
});
