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

  describe('getClient', () => {
    it('should return the redis client', () => {
      expect(service.getClient()).toBe(mockRedis);
    });

    it('should throw if redis is not connected', () => {
      const emptyService = new RedisService(null as any);
      expect(() => emptyService.getClient()).toThrow('Redis is not connected');
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
