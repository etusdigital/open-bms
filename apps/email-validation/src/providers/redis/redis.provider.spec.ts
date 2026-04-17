import { redisProvider, REDIS } from './redis.provider';

describe('redisProvider', () => {
  beforeEach(() => {
    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = 'testpass';
  });

  it('should have the REDIS symbol as the provide token', () => {
    expect(redisProvider.provide).toBe(REDIS);
  });

  it('should create an ioredis instance with lazyConnect', () => {
    const redis = redisProvider.useFactory();

    expect(redis).toBeDefined();
    expect(redis.options.host).toBe('127.0.0.1');
    expect(redis.options.port).toBe(6379);
    expect(redis.options.password).toBe('testpass');
    expect(redis.options.lazyConnect).toBe(true);

    // Disconnect to avoid open handle
    redis.disconnect();
  });
});
