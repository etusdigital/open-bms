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
    await this.redis.connect();
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
