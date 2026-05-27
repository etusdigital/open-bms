import { redisProvider, REDIS } from './redis.provider';

describe('RedisProvider', () => {
  it('should have correct provide symbol', () => {
    expect(redisProvider.provide).toBe(REDIS);
  });

  it('should create a Redis instance via useFactory', () => {
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = '';
    const client = redisProvider.useFactory();
    expect(client).toBeDefined();
    // Clean up: disconnect
    client.disconnect();
  });
});
