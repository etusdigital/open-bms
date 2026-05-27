import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    service = new RedisService(mockRedis);
  });

  describe('getOrThrow', () => {
    it('should return redis instance when connected', () => {
      const result = service.getOrThrow();
      expect(result).toBe(mockRedis);
    });

    it('should throw when redis is null', () => {
      const serviceWithoutRedis = new RedisService(null);
      expect(() => serviceWithoutRedis.getOrThrow()).toThrow('Redis is not connected');
    });
  });

  describe('onModuleInit', () => {
    it('should call redis.connect', async () => {
      await service.onModuleInit();
      expect(mockRedis.connect).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call redis.quit', async () => {
      await service.onModuleDestroy();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
