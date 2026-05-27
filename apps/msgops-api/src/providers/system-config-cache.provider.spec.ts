import { SystemConfigCacheProvider } from './system-config-cache.provider';
import type { Repository } from 'typeorm';
import type { RedisService } from './redis.provider';
import type { SystemConfigEntity } from '../entities/system-config.entity';

interface FakeRedis {
  get: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
}

function makeFixtures() {
  const redisClient: FakeRedis = {
    get: jest.fn(),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
  const redis = { getClient: () => redisClient } as unknown as RedisService;
  const repo = { findOne: jest.fn() } as unknown as Repository<SystemConfigEntity>;
  return { redisClient, redis, repo };
}

describe('SystemConfigCacheProvider', () => {
  it('returns cached value when present in Redis', async () => {
    const { redisClient, redis, repo } = makeFixtures();
    redisClient.get.mockResolvedValue(JSON.stringify({ foo: 'bar' }));
    const sut = new SystemConfigCacheProvider(repo, redis);

    const result = await sut.get<{ foo: string }>('s3_settings');

    expect(result).toEqual({ foo: 'bar' });
    expect(redisClient.get).toHaveBeenCalledWith('system_config:s3_settings');
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('falls back to repo and populates Redis on miss', async () => {
    const { redisClient, redis, repo } = makeFixtures();
    redisClient.get.mockResolvedValue(null);
    (repo.findOne as jest.Mock).mockResolvedValue({ key: 's3_settings', value: { foo: 'baz' } });

    const sut = new SystemConfigCacheProvider(repo, redis);
    const result = await sut.get<{ foo: string }>('s3_settings');

    expect(result).toEqual({ foo: 'baz' });
    expect(redisClient.setex).toHaveBeenCalledWith('system_config:s3_settings', 60, JSON.stringify({ foo: 'baz' }));
  });

  it('returns null when DB has no row', async () => {
    const { redisClient, redis, repo } = makeFixtures();
    redisClient.get.mockResolvedValue(null);
    (repo.findOne as jest.Mock).mockResolvedValue(null);

    const sut = new SystemConfigCacheProvider(repo, redis);
    const result = await sut.get('s3_settings');

    expect(result).toBeNull();
    expect(redisClient.setex).not.toHaveBeenCalled();
  });

  it('invalidate calls DEL with prefixed key', async () => {
    const { redisClient, redis, repo } = makeFixtures();
    const sut = new SystemConfigCacheProvider(repo, redis);

    await sut.invalidate('s3_settings');

    expect(redisClient.del).toHaveBeenCalledWith('system_config:s3_settings');
  });

  it('survives Redis errors and falls back to repo', async () => {
    const { redisClient, redis, repo } = makeFixtures();
    redisClient.get.mockRejectedValue(new Error('boom'));
    (repo.findOne as jest.Mock).mockResolvedValue({ key: 's3_settings', value: { foo: 'qux' } });

    const sut = new SystemConfigCacheProvider(repo, redis);
    const result = await sut.get<{ foo: string }>('s3_settings');

    expect(result).toEqual({ foo: 'qux' });
  });
});
