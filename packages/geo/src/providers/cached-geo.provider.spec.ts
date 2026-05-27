import {
  CachedGeoProvider,
  DEFAULT_GEO_CACHE_OPTIONS,
} from './cached-geo.provider';
import type { GeoData, GeoProvider } from '../geo-provider.interface';

class FakeRedis {
  store = new Map<string, string>();
  expirations = new Map<string, number>();
  getMock = jest.fn(async (key: string) => this.store.get(key) ?? null);
  setMock = jest.fn(
    async (key: string, value: string, _mode: string, ttl: number) => {
      this.store.set(key, value);
      this.expirations.set(key, ttl);
      return 'OK';
    },
  );

  get(key: string) {
    return this.getMock(key);
  }
  set(key: string, value: string, mode: string, ttl: number) {
    return this.setMock(key, value, mode, ttl);
  }
}

class StubProvider implements GeoProvider {
  lookup = jest.fn<Promise<GeoData | null>, [string]>();
}

function makeSubject(redis: FakeRedis, inner: StubProvider): CachedGeoProvider {
  return new CachedGeoProvider(
    inner,
    redis as unknown as import('ioredis').Redis,
    { ...DEFAULT_GEO_CACHE_OPTIONS },
  );
}

describe('CachedGeoProvider', () => {
  let redis: FakeRedis;
  let inner: StubProvider;
  let subject: CachedGeoProvider;

  beforeEach(() => {
    redis = new FakeRedis();
    inner = new StubProvider();
    subject = makeSubject(redis, inner);
  });

  it('returns cached hit without calling inner provider', async () => {
    const cached: GeoData = { country: 'US', region: 'CA', city: 'San Francisco' };
    redis.store.set(
      `${DEFAULT_GEO_CACHE_OPTIONS.keyPrefix}:8.8.8.8`,
      JSON.stringify(cached),
    );

    const result = await subject.lookup('8.8.8.8');

    expect(result).toEqual(cached);
    expect(inner.lookup).not.toHaveBeenCalled();
  });

  it('queries inner provider on cache miss and writes hit TTL', async () => {
    const fresh: GeoData = { country: 'BR' };
    inner.lookup.mockResolvedValueOnce(fresh);

    const result = await subject.lookup('200.160.0.1');

    expect(result).toEqual(fresh);
    expect(inner.lookup).toHaveBeenCalledWith('200.160.0.1');
    expect(redis.setMock).toHaveBeenCalledWith(
      `${DEFAULT_GEO_CACHE_OPTIONS.keyPrefix}:200.160.0.1`,
      JSON.stringify(fresh),
      'EX',
      DEFAULT_GEO_CACHE_OPTIONS.hitTtlSeconds,
    );
  });

  it('uses miss TTL when inner returns null', async () => {
    inner.lookup.mockResolvedValueOnce(null);

    const result = await subject.lookup('203.0.113.1');

    expect(result).toBeNull();
    expect(redis.setMock).toHaveBeenCalledWith(
      `${DEFAULT_GEO_CACHE_OPTIONS.keyPrefix}:203.0.113.1`,
      '__null__',
      'EX',
      DEFAULT_GEO_CACHE_OPTIONS.missTtlSeconds,
    );
  });

  it('returns null when cached as null sentinel without hitting inner', async () => {
    redis.store.set(
      `${DEFAULT_GEO_CACHE_OPTIONS.keyPrefix}:198.51.100.1`,
      '__null__',
    );

    const result = await subject.lookup('198.51.100.1');

    expect(result).toBeNull();
    expect(inner.lookup).not.toHaveBeenCalled();
  });

  it('falls through to inner provider when redis read throws', async () => {
    redis.getMock.mockRejectedValueOnce(new Error('redis offline'));
    const fresh: GeoData = { country: 'DE' };
    inner.lookup.mockResolvedValueOnce(fresh);

    const result = await subject.lookup('194.25.0.60');

    expect(result).toEqual(fresh);
    expect(inner.lookup).toHaveBeenCalledWith('194.25.0.60');
  });

  it('still returns inner result when redis write throws', async () => {
    redis.setMock.mockRejectedValueOnce(new Error('write failed'));
    const fresh: GeoData = { country: 'US' };
    inner.lookup.mockResolvedValueOnce(fresh);

    const result = await subject.lookup('1.1.1.1');

    expect(result).toEqual(fresh);
  });

  it('returns null for empty IP without calling inner or redis', async () => {
    const result = await subject.lookup('');

    expect(result).toBeNull();
    expect(inner.lookup).not.toHaveBeenCalled();
    expect(redis.getMock).not.toHaveBeenCalled();
  });
});
