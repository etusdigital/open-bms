import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from './redis.provider';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  getClient(): Redis {
    if (!this.redis) {
      throw new Error('Redis is not connected');
    }
    return this.redis;
  }

  async onModuleInit() {
    // BullModule (registered before us in app.module.ts) already opened a
    // connection on the shared ioredis instance, so calling connect() again
    // throws "Redis is already connecting/connected". Treat that as success —
    // the side effect we want (a live socket) is already in place. Any real
    // failure (DNS, auth) surfaces via the boot ping in main.ts.
    try {
      await this.redis.connect();
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (!/already connect/i.test(msg)) throw err;
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
