import { Module, Global, Injectable, DynamicModule } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Drop-in replacement for nestjs-redis's RedisService.
 * Provides the same .getClient() API to minimize code changes across the codebase.
 */
@Injectable()
export class RedisService {
  private client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  getClient(): Redis {
    return this.client;
  }
}

export interface RedisModuleOptions {
  host?: string;
  port?: number;
  password?: string;
}

@Global()
@Module({})
export class RedisModule {
  static register(options: RedisModuleOptions): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: 'REDIS_CLIENT_INSTANCE',
          useFactory: () => {
            // Docker Swarm DNS race: overlay pode demorar para registrar o
            // hostname `redis`. Sem retryStrategy + maxRetriesPerRequest=null
            // o ioredis fica em loop de ENOTFOUND e nunca recupera (incidente
            // visto em staging com send-whatsapp / campanhas paradas).
            return new Redis({
              host: options.host || 'localhost',
              port: options.port || 6379,
              password: options.password || undefined,
              lazyConnect: true,
              enableReadyCheck: false,
              maxRetriesPerRequest: null,
              retryStrategy: (times: number) => Math.min(times * 200, 5000),
            });
          },
        },
        {
          provide: RedisService,
          useFactory: (client: Redis) => {
            return new RedisService(client);
          },
          inject: ['REDIS_CLIENT_INSTANCE'],
        },
      ],
      exports: [RedisService],
    };
  }
}
