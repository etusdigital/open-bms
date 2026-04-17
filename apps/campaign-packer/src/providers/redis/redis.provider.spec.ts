const mockRedisInstance = {
  connect: jest.fn(),
  quit: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
};

jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(() => mockRedisInstance);
  return { __esModule: true, default: MockRedis };
});

import { redisProvider, REDIS } from './redis.provider';

describe('redisProvider', () => {
  beforeEach(() => {
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = 'testpass';
  });

  it('should provide REDIS token', () => {
    expect(redisProvider.provide).toBe(REDIS);
  });

  it('should create a Redis client from useFactory', () => {
    const client = redisProvider.useFactory();
    expect(client).toBeDefined();
    expect(client).toBe(mockRedisInstance);
  });
});
