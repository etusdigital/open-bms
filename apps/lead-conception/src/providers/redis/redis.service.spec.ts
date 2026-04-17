import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  const mockRedis = {
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue('OK'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RedisService(mockRedis as any);
  });

  describe('getOrThrow', () => {
    it('should return the redis instance when connected', () => {
      const result = service.getOrThrow();
      expect(result).toBe(mockRedis);
    });

    it('should throw when redis is null', () => {
      const nullService = new RedisService(null as any);
      expect(() => nullService.getOrThrow()).toThrow('Redis is not connected');
    });
  });

  describe('onModuleInit', () => {
    it('should call redis.connect()', async () => {
      await service.onModuleInit();
      expect(mockRedis.connect).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call redis.quit()', async () => {
      await service.onModuleDestroy();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
