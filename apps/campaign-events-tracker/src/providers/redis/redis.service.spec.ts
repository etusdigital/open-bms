import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { REDIS } from './redis.provider';

describe('RedisService', () => {
  let service: RedisService;
  const mockRedis = {
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService, { provide: REDIS, useValue: mockRedis }],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getClient', () => {
    it('should return the redis client', () => {
      const client = service.getClient();
      expect(client).toBe(mockRedis);
    });

    it('should throw error when redis is not connected', () => {
      // Create a service with null redis to test the error branch
      const nullService = new RedisService(null as any);
      expect(() => nullService.getClient()).toThrow('Redis is not connected');
    });
  });

  describe('onModuleInit', () => {
    it('should connect to redis', async () => {
      await service.onModuleInit();
      expect(mockRedis.connect).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit redis connection', async () => {
      await service.onModuleDestroy();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
