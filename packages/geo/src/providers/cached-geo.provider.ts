import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { GeoProvider, GeoData } from '../geo-provider.interface';

// Token used by GeoModule to inject the underlying provider this decorator
// wraps. Kept distinct from GEO_PROVIDER_TOKEN so consumers always resolve
// the cached entry point via the public token.
export const GEO_INNER_PROVIDER_TOKEN = 'GEO_INNER_PROVIDER_TOKEN';

// Token for the Redis client used by the cache. The module wires this from
// either an explicit ioredis instance or env-derived connection options.
export const GEO_CACHE_REDIS_TOKEN = 'GEO_CACHE_REDIS_TOKEN';

export const GEO_CACHE_OPTIONS_TOKEN = 'GEO_CACHE_OPTIONS_TOKEN';

export interface GeoCacheOptions {
  // TTL applied when the underlying provider returns a hit (seconds).
  hitTtlSeconds: number;
  // TTL applied when the underlying provider returns null. Kept short so a
  // transient outage doesn't pin every IP as "no data" for a full day.
  missTtlSeconds: number;
  // Cache key prefix; bumping the version invalidates all existing entries.
  keyPrefix: string;
}

export const DEFAULT_GEO_CACHE_OPTIONS: GeoCacheOptions = {
  hitTtlSeconds: 86_400, // 24h — DB-IP refreshes monthly, IP→geo is stable
  missTtlSeconds: 3_600, // 1h — re-check IPs the provider couldn't resolve
  keyPrefix: 'geo:lookup:v1',
};

const NULL_SENTINEL = '__null__';

@Injectable()
export class CachedGeoProvider implements GeoProvider {
  private readonly logger = new Logger(CachedGeoProvider.name);

  constructor(
    @Inject(GEO_INNER_PROVIDER_TOKEN) private readonly inner: GeoProvider,
    @Inject(GEO_CACHE_REDIS_TOKEN) private readonly redis: Redis,
    @Inject(GEO_CACHE_OPTIONS_TOKEN) private readonly options: GeoCacheOptions,
  ) {}

  async lookup(ip: string): Promise<GeoData | null> {
    if (!ip) return null;

    const key = `${this.options.keyPrefix}:${ip}`;

    // Cache hit — short-circuit before touching the inner provider.
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        return cached === NULL_SENTINEL ? null : (JSON.parse(cached) as GeoData);
      }
    } catch (error) {
      // Redis flakiness must not break enrichment — log once and fall through.
      this.logger.warn(
        `geo_cache_read_failed ip=${ip} err=${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const result = await this.inner.lookup(ip);

    try {
      const value = result === null ? NULL_SENTINEL : JSON.stringify(result);
      const ttl = result === null ? this.options.missTtlSeconds : this.options.hitTtlSeconds;
      if (ttl > 0) {
        await this.redis.set(key, value, 'EX', ttl);
      }
    } catch (error) {
      this.logger.warn(
        `geo_cache_write_failed ip=${ip} err=${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }
}
