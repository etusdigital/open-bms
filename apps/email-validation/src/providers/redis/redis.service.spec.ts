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

  describe('getOrThrow()', () => {
    it('should return the redis instance when connected', () => {
      const result = service.getOrThrow();
      expect(result).toBe(mockRedis);
    });

    it('should throw when redis is null', () => {
      const nullService = new RedisService(null as any);
      expect(() => nullService.getOrThrow()).toThrow('Redis is not connected');
    });

    it('should throw when redis is undefined', () => {
      const undefinedService = new RedisService(undefined as any);
      expect(() => undefinedService.getOrThrow()).toThrow('Redis is not connected');
    });
  });

  describe('onModuleInit()', () => {
    it('should call redis.connect()', async () => {
      await service.onModuleInit();
      expect(mockRedis.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy()', () => {
    it('should call redis.quit()', async () => {
      await service.onModuleDestroy();
      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });
  });
});
