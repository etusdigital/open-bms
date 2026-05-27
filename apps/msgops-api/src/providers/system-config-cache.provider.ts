import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfigEntity } from '../entities/system-config.entity';
import { RedisService } from './redis.provider';

const TTL_SECONDS = 60;
const PREFIX = 'system_config:';

// Caches reads of system_config rows in Redis with a short TTL. Writers
// invalidate the entry explicitly so saves take effect immediately even
// before the TTL expires.
@Injectable()
export class SystemConfigCacheProvider {
  private readonly logger = new Logger(SystemConfigCacheProvider.name);

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly redis: RedisService,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const cacheKey = PREFIX + key;
    try {
      const cached = await this.redis.getClient().get(cacheKey);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch (err: any) {
      this.logger.warn(`redis_get_failed key=${key} err=${err?.message ?? 'unknown'}`);
    }

    const row = await this.repo.findOne({ where: { key } });
    if (!row) return null;

    try {
      await this.redis.getClient().setex(cacheKey, TTL_SECONDS, JSON.stringify(row.value));
    } catch (err: any) {
      this.logger.warn(`redis_setex_failed key=${key} err=${err?.message ?? 'unknown'}`);
    }
    return row.value as T;
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.getClient().del(PREFIX + key);
    } catch (err: any) {
      this.logger.warn(`redis_del_failed key=${key} err=${err?.message ?? 'unknown'}`);
    }
  }
}
