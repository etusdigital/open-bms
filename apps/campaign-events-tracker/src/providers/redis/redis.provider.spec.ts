import { redisProvider, REDIS } from './redis.provider';

describe('RedisProvider', () => {
  it('should have REDIS symbol as provide token', () => {
    expect(redisProvider.provide).toBe(REDIS);
  });

  it('should have a useFactory function', () => {
    expect(typeof redisProvider.useFactory).toBe('function');
  });

  it('should create a Redis instance with env config', () => {
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = 'testpass';

    const redis = redisProvider.useFactory();
    expect(redis).toBeDefined();
    expect(redis.options.host).toBe('localhost');
    expect(redis.options.port).toBe(6379);
    expect(redis.options.password).toBe('testpass');
    expect(redis.options.lazyConnect).toBe(true);
    expect(redis.options.enableOfflineQueue).toBe(true);

    // Clean up
    redis.disconnect();
  });
});
