import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
    };

    service = new RedisService(mockRedis);
  });

  describe('getOrThrow', () => {
    it('should return redis client when connected', () => {
      const result = service.getOrThrow();
      expect(result).toBe(mockRedis);
    });

    it('should throw when redis is null', () => {
      const svc = new RedisService(null);
      expect(() => svc.getOrThrow()).toThrow('Redis is not connected');
    });

    it('should throw when redis is undefined', () => {
      const svc = new RedisService(undefined);
      expect(() => svc.getOrThrow()).toThrow('Redis is not connected');
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
