import { Injectable } from '@nestjs/common';
import { RedisService } from '../../providers/redis.provider';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AccountConfigEntity } from '../../entities/account-config.entity';

@Injectable()
export class AccountCacheService {
  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,
  ) {}

  /**
   * Invalidates ALL caches related to the account
   * Covers the patterns:
   * - account:${base64(apiKey)} (used by msgops-lead-receive, msgops-lead-conception)
   * - accountConfig:${apiKey} (used by msgops-tracker)
   */
  async invalidateAccountCache(accountId: number): Promise<void> {
    try {
      const redisClient = await this.redisService.getClient();

      // 1. Fetch all API keys for the account (api_key and api_key_tracker)
      const configs = await this.accountConfigRepository.find({
        where: {
          accountId,
          name: In(['api_key', 'api_key_tracker']),
        },
      });

      if (!configs.length) {
        return;
      }

      const keysToDelete: string[] = [];

      for (const config of configs) {
        // Pattern 1: account:${Buffer.from(apiKey).toString('base64')}
        // Used by: msgops-lead-receive, msgops-lead-conception
        const apiKeyEncrypted = Buffer.from(config.value).toString('base64');
        keysToDelete.push(`account:${apiKeyEncrypted}`);

        // Pattern 2: accountConfig:${apiKey}
        // Used by: msgops-tracker
        keysToDelete.push(`accountConfig:${config.value}`);
      }

      // 3. Delete all keys
      if (keysToDelete.length > 0) {
        await redisClient.del(keysToDelete);
      }
    } catch (error) {
      console.error(`[AccountCache] Error invalidating cache for account ${accountId}:`, error);
      // Don't fail the main operation if cache invalidation fails
    }
  }

  /**
   * Asynchronous invalidation to not block the API response
   */
  invalidateAccountCacheAsync(accountId: number): void {
    this.invalidateAccountCache(accountId).catch((error) => {
      console.error(`[AccountCache] Async invalidation failed for account ${accountId}:`, error);
    });
  }
}
