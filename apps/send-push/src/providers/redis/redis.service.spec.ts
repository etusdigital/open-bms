import { RedisService } from './redis.service';

describe('RedisService', () => {
  let mockRedis: {
    connect: jest.Mock;
    quit: jest.Mock;
  };
  let service: RedisService;

  beforeEach(() => {
    mockRedis = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    service = new RedisService(mockRedis as never);
  });

  it('getClient should return the redis instance', () => {
    expect(service.getClient()).toBe(mockRedis);
  });

  it('onModuleInit should call connect', async () => {
    await service.onModuleInit();
    expect(mockRedis.connect).toHaveBeenCalled();
  });

  it('onModuleDestroy should call quit', async () => {
    await service.onModuleDestroy();
    expect(mockRedis.quit).toHaveBeenCalled();
  });

  it('getClient should throw when redis is falsy', () => {
    const emptyService = new RedisService(null as never);
    expect(() => emptyService.getClient()).toThrow('Redis is not connected');
  });
});
