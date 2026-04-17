import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn(),
    };
    service = new RedisService(mockRedis);
  });

  describe('getOrThrow', () => {
    it('should return the redis instance', () => {
      const result = service.getOrThrow();
      expect(result).toBe(mockRedis);
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
