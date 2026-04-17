import { Injectable } from '@nestjs/common';
import { AccountEntity } from './entities/account.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AccountApiKeyEntity } from './entities/account-api-key.entity';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from '../providers/redis/redis.service';
import type Redis from 'ioredis';
import { createHash } from 'crypto';

@Injectable()
export class MsgopsService {
  private readonly redisClient: Redis;

  constructor(
    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,

    @InjectRepository(AccountApiKeyEntity)
    private readonly accountApiKeyRepository: Repository<AccountApiKeyEntity>,

    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,

    private readonly redisService: RedisService,
  ) {
    this.redisClient = this.redisService.getOrThrow();
  }

  private hashApiKey(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  async findAccountByApiKey(apiKey: string): Promise<AccountEntity | undefined> {
    const apiKeyEncripted = Buffer.from(apiKey).toString('base64');
    const redisKey = `account:${apiKeyEncripted}`;
    const cacheData = await this.redisClient.get(redisKey);
    let accountCache: AccountEntity | undefined;

    if (cacheData) {
      try {
        accountCache = JSON.parse(cacheData) as AccountEntity;
      } catch (e) {
        console.error('Error parsing cached account data:', e);
      }
    }

    if (accountCache) {
      // Check managed key expiration first
      if (await this.isManagedKeyExpired(apiKey)) {
        return undefined;
      }
      // Fallback: check legacy config expiration
      if (this.isApiKeyExpiredFromConfigs(accountCache.id, apiKey, accountCache.accountConfigs)) {
        return undefined;
      }
      return accountCache;
    }

    // 1. Try managed keys table first (accounts_api_keys)
    const accountId = await this.resolveAccountFromManagedKey(apiKey);
    if (accountId) {
      const account = await this.accountRepository.findOneBy({ id: accountId });
      if (account) {
        await this.redisClient.set(redisKey, JSON.stringify(account));
        return account;
      }
    }

    // 2. Fallback to legacy accounts_configs
    const accountConfig = await this.accountConfigRepository.findOne({
      where: [
        { name: 'api_key', value: apiKey },
        { name: 'api_key_tracker', value: apiKey },
      ],
    });

    if (!accountConfig) {
      return undefined;
    }

    const account = await this.accountRepository.findOneBy({ id: accountConfig.accountId });

    if (!account) {
      return undefined;
    }

    await this.redisClient.set(redisKey, JSON.stringify(account));

    if (this.isApiKeyExpiredFromConfigs(account.id, apiKey, account.accountConfigs)) {
      return undefined;
    }

    return account;
  }

  private async resolveAccountFromManagedKey(apiKey: string): Promise<number | null> {
    const keyHash = this.hashApiKey(apiKey);
    const now = new Date();

    const managedKey = await this.accountApiKeyRepository.findOne({
      where: [
        { keyHash, status: 'active', revokedAt: IsNull(), expiresAt: IsNull() },
        { keyHash, status: 'active', revokedAt: IsNull(), expiresAt: MoreThan(now) },
      ],
    });

    return managedKey?.accountId || null;
  }

  private async isManagedKeyExpired(apiKey: string): Promise<boolean> {
    const keyHash = this.hashApiKey(apiKey);

    const managedKey = await this.accountApiKeyRepository.findOne({
      where: { keyHash },
    });

    // Not a managed key — let legacy check handle it
    if (!managedKey) {
      return false;
    }

    if (managedKey.status !== 'active' || managedKey.revokedAt) {
      console.log(`[MsgopsService] Revoked managed API key used | accountId=${managedKey.accountId} apiKey=${apiKey}`);
      return true;
    }

    if (managedKey.expiresAt && new Date(managedKey.expiresAt) <= new Date()) {
      console.log(`[MsgopsService] Expired managed API key used | accountId=${managedKey.accountId} apiKey=${apiKey}`);
      return true;
    }

    return false;
  }

  private isApiKeyExpiredFromConfigs(accountId: number, apiKey: string, configs?: AccountConfigEntity[]): boolean {
    if (!configs || !configs.length) {
      return false;
    }

    const matchedConfig = configs.find(
      (c) => (c.name === 'api_key' || c.name === 'api_key_tracker') && c.value === apiKey,
    );

    if (!matchedConfig) {
      return false;
    }

    const expiresAtConfig = configs.find((c) => c.name === `${matchedConfig.name}_expires_at`);

    if (!expiresAtConfig) {
      return false;
    }

    const isExpired = new Date(expiresAtConfig.value) <= new Date();
    if (isExpired) {
      console.log(
        `[MsgopsService] Expired API key used | accountId=${accountId} keyType=${matchedConfig.name} apiKey=${apiKey}`,
      );
    }

    return isExpired;
  }
}
