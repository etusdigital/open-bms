import { redisProvider, REDIS } from './redis.provider';

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((opts) => ({ opts, mocked: true })),
  };
});

describe('redisProvider', () => {
  beforeEach(() => {
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = 'secret';
  });

  it('should provide REDIS symbol', () => {
    expect(redisProvider.provide).toBe(REDIS);
  });

  it('useFactory should create a Redis instance with env config', () => {
    const result = redisProvider.useFactory();
    expect(result).toEqual(expect.objectContaining({ mocked: true }));
  });
});
