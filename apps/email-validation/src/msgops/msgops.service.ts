import { Injectable } from '@nestjs/common';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AccountApiKeyEntity } from './entities/account-api-key.entity';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from '../providers/redis/redis.service';
import { EmailValidateEntity } from './entities/email-validate.entity';
import { AccountUsageEntity } from './entities/account-usage.entity';
import { AccountEntity } from './entities/account.entity';
import { createHash } from 'crypto';

@Injectable()
export class MsgopsService {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,
    @InjectRepository(AccountApiKeyEntity)
    private readonly accountApiKeyRepository: Repository<AccountApiKeyEntity>,
    @InjectRepository(EmailValidateEntity)
    private readonly emailValidateRepository: Repository<EmailValidateEntity>,
    @InjectRepository(AccountUsageEntity)
    private readonly accountUsageRepository: Repository<AccountUsageEntity>,
    private readonly redisService: RedisService,
  ) {}

  private get redis() {
    return this.redisService.getOrThrow();
  }

  private hashApiKey(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  async findAccountByApiKey(apiKey: string): Promise<AccountEntity | undefined> {
    if (!apiKey) {
      return undefined;
    }

    const redis = this.redis;
    const apiKeyEncripted = Buffer.from(apiKey).toString('base64');
    const redisKey = `account:${apiKeyEncripted}`;
    let accountCache: AccountEntity | undefined;

    const cacheData = await redis.get(redisKey);
    if (cacheData) {
      try {
        accountCache = JSON.parse(cacheData) as AccountEntity;
      } catch (e) {
        console.error('Error parsing cached account data:', e);
      }
    }

    if (accountCache) {
      if (await this.isManagedKeyExpired(apiKey)) {
        return undefined;
      }
      if (this.isApiKeyExpiredFromConfigs(accountCache.id, apiKey, accountCache.accountConfigs)) {
        return undefined;
      }
      return this.accountRepository.create(accountCache);
    }

    // 1. Try managed keys table first (accounts_api_keys)
    const managedAccountId = await this.resolveAccountFromManagedKey(apiKey);
    if (managedAccountId) {
      const account = await this.accountRepository.findOneBy({ id: managedAccountId });
      if (account) {
        await redis.set(redisKey, JSON.stringify(account));
        return account;
      }
    }

    // 2. Fallback to legacy accounts_configs
    const accountConfig = await this.accountConfigRepository.findOne({
      relations: ['account'],
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

    await redis.set(redisKey, JSON.stringify(account));

    if (this.isApiKeyExpiredFromConfigs(account.id, apiKey, account.accountConfigs)) {
      return undefined;
    }

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
    const managedKey = await this.accountApiKeyRepository.findOne({ where: { keyHash } });

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

    const matchedConfig = configs.find((c) => (c.name === 'api_key' || c.name === 'api_key_tracker') && c.value === apiKey);

    if (!matchedConfig) {
      return false;
    }

    const expiresAtConfig = configs.find((c) => c.name === `${matchedConfig.name}_expires_at`);

    if (!expiresAtConfig) {
      return false;
    }

    const isExpired = new Date(expiresAtConfig.value) <= new Date();
    if (isExpired) {
      console.log(`[MsgopsService] Expired API key used | accountId=${accountId} keyType=${matchedConfig.name} apiKey=${apiKey}`);
    }

    return isExpired;
  }

  async findByEmail(email: string) {
    return await this.emailValidateRepository.createQueryBuilder('email_validations').where(`email = '${email}' AND updated_at > CURRENT_DATE - interval '7 day'`).getOne();
  }

  async createOrUpdateAccountUsage(accountId) {
    const query = `INSERT INTO accounts_usages (account_id, service, date, count)
      VALUES(${accountId}, 'EMAIL_VALIDATE', CURRENT_DATE, 1)
      ON CONFLICT(account_id, service, date) DO UPDATE
      SET count = accounts_usages.count + 1`;

    const entityManager = this.accountUsageRepository.manager;
    return await entityManager.query(query);
  }

  async createOrUpdateEmail(emailValidate) {
    emailValidate.updatedAt = new Date();
    return await this.emailValidateRepository
      .createQueryBuilder('email_validations')
      .insert()
      .values(emailValidate)
      .orUpdate(['reason', 'response', 'status', 'updated_at'], ['email'])
      .execute();
  }
}
