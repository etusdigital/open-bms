import { redisProvider, REDIS } from './redis.provider';

describe('RedisProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: 'testpass',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should have REDIS as the provide token', () => {
    expect(redisProvider.provide).toBe(REDIS);
  });

  it('should create a Redis instance via useFactory', () => {
    const redis = redisProvider.useFactory();
    expect(redis).toBeDefined();
    expect(redis.options.host).toBe('localhost');
    expect(redis.options.port).toBe(6379);
    expect(redis.options.password).toBe('testpass');
    expect(redis.options.lazyConnect).toBe(true);
    // Disconnect the instance to avoid open handles
    redis.disconnect();
  });
});
