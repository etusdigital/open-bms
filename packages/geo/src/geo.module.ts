import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { credentials } from '@grpc/grpc-js';
import { join } from 'path';
import { GrpcGeoProvider, GEO_GRPC_CLIENT } from './providers/grpc-geo.provider';
import { NoopGeoProvider } from './providers/noop-geo.provider';
import { ApiGeoProvider } from './providers/api-geo.provider';
import {
  CachedGeoProvider,
  DEFAULT_GEO_CACHE_OPTIONS,
  GEO_CACHE_OPTIONS_TOKEN,
  GEO_CACHE_REDIS_TOKEN,
  GEO_INNER_PROVIDER_TOKEN,
  GeoCacheOptions,
} from './providers/cached-geo.provider';

export const GEO_PROVIDER_TOKEN = 'GEO_PROVIDER_TOKEN';

export interface GeoModuleOptions {
  // Whether to wrap the underlying provider in a Redis cache. Defaults to
  // true when REDIS_HOST is set in the environment (and GEO_CACHE_ENABLED is
  // not explicitly "false"). Set to false to opt out — useful in tests.
  useCache?: boolean;
  // Override cache TTLs / key prefix. Falls back to DEFAULT_GEO_CACHE_OPTIONS
  // when not provided.
  cacheOptions?: Partial<GeoCacheOptions>;
}

function shouldUseCache(opts: GeoModuleOptions): boolean {
  if (opts.useCache !== undefined) return opts.useCache;
  if (process.env.GEO_CACHE_ENABLED === 'false') return false;
  return Boolean(process.env.REDIS_HOST);
}

function resolveCacheOptions(opts: GeoModuleOptions): GeoCacheOptions {
  const fromEnv: Partial<GeoCacheOptions> = {};
  if (process.env.GEO_CACHE_TTL_SECONDS) {
    const v = Number(process.env.GEO_CACHE_TTL_SECONDS);
    if (Number.isFinite(v) && v > 0) fromEnv.hitTtlSeconds = v;
  }
  if (process.env.GEO_CACHE_NULL_TTL_SECONDS) {
    const v = Number(process.env.GEO_CACHE_NULL_TTL_SECONDS);
    if (Number.isFinite(v) && v > 0) fromEnv.missTtlSeconds = v;
  }
  return {
    ...DEFAULT_GEO_CACHE_OPTIONS,
    ...fromEnv,
    ...opts.cacheOptions,
  };
}

// Lazily import ioredis so consumers that disable the cache don't need it
// installed. Constructed with the same envs the rest of the monorepo uses
// (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD).
function buildRedisProvider(): Provider {
  return {
    provide: GEO_CACHE_REDIS_TOKEN,
    useFactory: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { default: Redis } = require('ioredis') as typeof import('ioredis');
      return new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        // Don't crash on boot if Redis is briefly unavailable — the provider
        // logs and falls back to direct lookups.
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
    },
  };
}

@Module({})
export class GeoModule {
  static register(options: GeoModuleOptions = {}): DynamicModule {
    const providerType = process.env.GEO_PROVIDER ?? 'local';
    const useCache = shouldUseCache(options);

    const innerProviderClass = pickInnerProviderClass(providerType);
    const innerImports = innerProviderClass === GrpcGeoProvider ? [grpcClientImport()] : [];

    if (!useCache) {
      return {
        module: GeoModule,
        imports: innerImports,
        providers: [
          innerProviderClass,
          { provide: GEO_PROVIDER_TOKEN, useExisting: innerProviderClass },
        ],
        exports: [GEO_PROVIDER_TOKEN],
      };
    }

    const cacheOptions = resolveCacheOptions(options);

    return {
      module: GeoModule,
      imports: innerImports,
      providers: [
        innerProviderClass,
        { provide: GEO_INNER_PROVIDER_TOKEN, useExisting: innerProviderClass },
        { provide: GEO_CACHE_OPTIONS_TOKEN, useValue: cacheOptions },
        buildRedisProvider(),
        CachedGeoProvider,
        { provide: GEO_PROVIDER_TOKEN, useExisting: CachedGeoProvider },
      ],
      exports: [GEO_PROVIDER_TOKEN],
    };
  }
}

function pickInnerProviderClass(providerType: string): Type<unknown> {
  if (providerType === 'local') return GrpcGeoProvider;
  if (providerType === 'api') return ApiGeoProvider;
  return NoopGeoProvider;
}

function grpcClientImport() {
  const grpcUrl =
    process.env.GEO_GRPC_URL || process.env.GEOIP_SERVICE_URL || 'localhost:50051';
  const isProduction = process.env.NODE_ENV === 'production';
  return ClientsModule.register([
    {
      name: GEO_GRPC_CLIENT,
      transport: Transport.GRPC,
      options: {
        package: 'geoip',
        protoPath: join(__dirname, './geoip.proto'),
        url: grpcUrl,
        ...(isProduction && { credentials: credentials.createSsl() }),
      },
    },
  ]);
}
