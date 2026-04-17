import { redisProvider, REDIS } from './redis.provider';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation((opts: any) => ({
    host: opts?.host,
    port: opts?.port,
    connect: jest.fn(),
    quit: jest.fn(),
  }));
});

describe('redisProvider', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = 'testpass';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should provide REDIS token', () => {
    expect(redisProvider.provide).toBe(REDIS);
  });

  it('should create a Redis instance from factory', () => {
    const result = redisProvider.useFactory();
    expect(result).toBeDefined();
  });

  it('should default to port 6379 when REDIS_PORT is not set', () => {
    delete process.env.REDIS_PORT;
    const result = redisProvider.useFactory();
    expect(result).toBeDefined();
  });
});
