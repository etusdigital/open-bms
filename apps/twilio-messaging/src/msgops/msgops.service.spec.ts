import { MsgopsService } from './msgops.service';
import { RedisService } from '../providers/redis/redis.service';
import { Repository } from 'typeorm';
import { ShortLinkEntity } from './entities/short-link.entity';

describe('MsgopsService', () => {
  let service: MsgopsService;
  let mockRepository: Partial<Repository<ShortLinkEntity>>;
  let mockRedisService: Partial<RedisService>;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        onConflict: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          raw: [{ short_code: 'abc123', long_url: 'https://example.com' }],
        }),
      }),
    };

    service = new MsgopsService(mockRepository as Repository<ShortLinkEntity>, mockRedisService as RedisService);
  });

  describe('generateShortCode', () => {
    it('should generate a 6-character string', () => {
      const code = service.generateShortCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Za-z0-9]{6}$/);
    });

    it('should generate different codes on multiple calls', () => {
      const codes = new Set(Array.from({ length: 10 }, () => service.generateShortCode()));
      // With 62^6 possibilities, collisions are extremely unlikely
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe('createShortLink', () => {
    it('should return undefined in test environment', async () => {
      process.env.NODE_ENV = 'test';
      const result = await service.createShortLink('https://example.com', 'https://short.link/');
      expect(result).toBeUndefined();
    });

    it('should create a short link in non-test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const result = await service.createShortLink('https://example.com', 'https://short.link/');
      expect(result).toBe('https://short.link/abc123');
      expect(mockRedisClient.set).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should retry on conflict (empty raw)', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      let callCount = 0;
      const mockQb = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        onConflict: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ raw: [] });
          }
          return Promise.resolve({
            raw: [{ short_code: 'xyz789', long_url: 'https://example.com' }],
          });
        }),
      };
      (mockRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQb);

      const result = await service.createShortLink('https://example.com', 'https://short.link/');
      expect(result).toBe('https://short.link/xyz789');
      expect(callCount).toBe(2);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('createRedisKey', () => {
    it('should set redis key with expiration', async () => {
      await service.createRedisKey({ short_code: 'abc123', long_url: 'https://example.com' });
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'redirect_short_link:abc123',
        'https://example.com',
        'EX',
        604800, // 7 days in seconds
      );
    });
  });
});
