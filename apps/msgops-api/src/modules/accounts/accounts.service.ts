import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccountEntity } from '../../entities/account.entity';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { PaginationDto } from '../../dtos/pagination.dto';
import { CreateAccountDto } from './dtos/create-account.dto';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { CustomFieldsEntity } from '../../entities/custom-fields.entity';
import { PageDto } from '../../dtos/filters/page.dto';
import { RedisService } from '../../providers/redis.provider';
import { createHash, randomBytes } from 'crypto';
import { S3StorageProvider } from '../../providers/s3-storage.provider';
import { SchedulerService } from 'src/providers/queue/scheduler.service';
import { QUEUE_BMS_USAGE } from 'src/providers/queue/queue.constants';
import dayjs from 'dayjs';
import { ClsService } from 'nestjs-cls';
import { AccountCacheService } from './account-cache.service';
import { AccountApiKeyEntity } from '../../entities/account-api-key.entity';
import { RoleEntity } from '../../entities/role.entity';
import { ROLE_CODES } from '../authz/authz.constants';

export const DEFAULT_ACCOUNT_TIMEZONE = 'America/Sao_Paulo';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(CustomFieldsEntity)
    private readonly customFieldRepository: Repository<CustomFieldsEntity>,
    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,
    @InjectRepository(UserAccountEntity)
    private readonly userAccountRepository: Repository<UserAccountEntity>,
    @InjectRepository(AccountApiKeyEntity)
    private readonly accountApiKeyRepository: Repository<AccountApiKeyEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    private readonly redisService: RedisService,
    private readonly storage: S3StorageProvider,
    private readonly scheduler: SchedulerService,
    private readonly cls: ClsService,
    private readonly httpService: HttpService,
    private readonly accountCacheService: AccountCacheService,
  ) {}

  // Sanitization of account configs happens at the HTTP serialization boundary via
  // AccountEntity.accountConfigs' @Transform (ClassSerializerInterceptor). In-process
  // consumers (e.g. AMQP publishers, internal handlers) receive the raw entity.

  async findAll(userId: number): Promise<Array<AccountEntity>> {
    try {
      const accounts = await this.accountRepository
        .createQueryBuilder('account')
        .leftJoin('account.userAccount', 'userAccount')
        .leftJoinAndSelect('account.accountConfigs', 'accountConfigs')
        .where(`(userAccount.user_id = :userId)`, { userId })
        .orderBy('account.name', 'ASC')
        .getMany();
      return accounts;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAllAccounts(): Promise<Array<AccountEntity>> {
    return this.accountRepository.find();
  }

  async findOneLightweight(id: number): Promise<{ id: number; name: string; isActive: boolean } | null> {
    return this.accountRepository
      .createQueryBuilder('account')
      .select(['account.id', 'account.name', 'account.isActive'])
      .where('account.id = :id', { id })
      .andWhere('account.deleted_at IS NULL')
      .getOne();
  }

  async getAllAccountsLightweight(): Promise<Array<{ id: number; name: string; isActive: boolean }>> {
    return this.accountRepository
      .createQueryBuilder('account')
      .select(['account.id', 'account.name', 'account.isActive'])
      .where('account.deleted_at IS NULL')
      .andWhere('account.is_active = true')
      .orderBy('account.name', 'ASC')
      .getMany();
  }

  async listPaginated(params: PageDto, userId: number): Promise<PaginationDto<AccountEntity>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'name';
      const order = params.order ? params.order : 'ASC';

      const accountsQuery = await this.accountRepository
        .createQueryBuilder('account')
        .leftJoin('account.userAccount', 'userAccount')
        .leftJoinAndSelect('account.accountConfigs', 'accountConfigs')
        .where(`(userAccount.user_id = :userId)`, { userId })
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`account.${sortBy}`, `${order}`);

      if (Array.isArray(params.search)) {
        const search = [params.search].flat();
        const accountNames = search.map((account) => account.toLowerCase());

        accountsQuery.andWhere(`(LOWER(account.name) IN (:...name))`, { name: accountNames });
      } else {
        accountsQuery.andWhere(`(account.name iLike :search OR account.description iLike :search)`, {
          search: `%${params.search ?? ''}%`,
        });
      }

      const [results, total] = await accountsQuery.getManyAndCount();

      return new PaginationDto<AccountEntity>({
        results,
        total,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(id: number): Promise<AccountEntity> {
    try {
      return this.accountRepository.findOneOrFail({ where: { id } });
    } catch (e) {
      console.error(e);
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }
  }

  async findOneIncludingDeleted(id: number): Promise<AccountEntity | null> {
    return this.accountRepository.findOne({ where: { id }, withDeleted: true });
  }

  // Idempotency helper for retried account provisioning (setup wizard / Enterprise
  // import). `accounts.name` carries a column-level DB UNIQUE constraint (NOT
  // partial on deleted_at), so a retry after a partial failure would otherwise
  // hit 23505 ("already exists"). Callers reuse the leftover account instead of
  // recreating it. `withDeleted` is required because the Enterprise import worker
  // soft-deletes the orphan account when a job fails before any progress
  // (cleanupOrphanAccount/F18) — that row still occupies the unique name.
  async findByName(name: string, opts?: { withDeleted?: boolean }): Promise<AccountEntity | null> {
    return this.accountRepository.findOne({ where: { name }, withDeleted: opts?.withDeleted ?? false });
  }

  // Un-delete a soft-deleted account so the unique name is usable again and the
  // row is visible/active. Used by the retry-safe import/wizard paths to recover
  // an orphan account instead of creating a duplicate (which would 23505).
  async restoreAccount(id: number): Promise<void> {
    await this.accountRepository.restore(id);
    await this.accountRepository.update(id, { isActive: true });
  }

  async findWithCleanConfigs(id: number) {
    const account = await this.accountRepository.findOneOrFail({ where: { id } });
    account.customFields = await this.customFieldRepository.find({ where: { accountId: id } });
    account.accountConfigs = await this.accountConfigRepository.find({ where: { accountId: id, isLoadConfig: true } });
    return account;
  }

  async getConfigs(accountId?: number): Promise<AccountConfigEntity[]> {
    const where = accountId ? { accountId } : {};
    const configs = await this.accountConfigRepository.find({ where });
    // Manual filtering needed here — configs are loaded directly, not through AccountEntity's @AfterLoad
    return AccountEntity.sanitizeAccountConfigs(configs);
  }

  async findByConfig(name: string, value: string): Promise<AccountConfigEntity> {
    try {
      return await this.accountConfigRepository.findOne({
        where: {
          name,
          value,
        },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }
  }

  async findAccountsByConfig(name: string, value: string): Promise<AccountConfigEntity[]> {
    try {
      return await this.accountConfigRepository.find({
        where: {
          name,
          value,
        },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }
  }

  async findByAccountConfig(accountId: number, name: string): Promise<AccountConfigEntity> {
    try {
      return await this.accountConfigRepository.findOne({
        where: {
          accountId,
          name,
        },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
    }
  }

  async create(accountDto: CreateAccountDto, userId: number, opts?: { skipDefaults?: boolean }): Promise<{ account: AccountEntity; dns?: any }> {
    // skipDefaults is set by the Enterprise → OSS importer: the caller takes
    // responsibility for custom fields, custom events, account_configs, and the
    // billing scheduler — all replicated from Enterprise. The remaining side
    // effects (main insert, users_accounts link, service-worker S3 upload) still
    // run because they uphold app invariants (without users_accounts the UI
    // breaks with "no accounts").
    const skipDefaults = opts?.skipDefaults ?? false;
    try {
      const account = this.accountRepository.create(accountDto);
      const accountEntity = await this.accountRepository.save(account);
      const dns = {};

      if (!accountDto.accountConfigs) {
        accountDto.accountConfigs = [];
      }

      // SendGrid subaccount provisioning was removed: the OSS uses a single
      // workspace-level API key (super-admin sets it in /settings) and a
      // single event webhook registered against that key. Account creation
      // is now purely a BMS-side operation; SendGrid resources are not
      // touched here. See sendgrid.handler.ts and settings.service.ts.

      if (accountDto.defaultDomain) {
        accountDto.accountConfigs.push({
          name: 'default_domain',
          value: accountDto.defaultDomain,
        });
      }

      if (!skipDefaults) {
        accountDto.accountConfigs.push({
          name: 'api_key_tracker',
          value: createHash('md5').update(`bms-${account.id}-api_key_tracker`).digest('hex'),
        });

        accountDto.accountConfigs.push({
          name: 'account_costs',
          value: [
            {
              name: 'EMAIL',
              unitCost: 0.0004,
              margin: 20,
            },
            {
              name: 'WEB_PUSH',
              unitCost: 0.00002,
              margin: 20,
            },
            {
              name: 'SMS',
              unitCost: 0.0415,
              margin: 20,
            },
            {
              name: 'WHATSAPP',
              unitCost: 0.35,
              margin: 20,
            },
            {
              name: 'COUNT_CONTACTS',
              unitCost: 0.0005,
              margin: 20,
            },
            {
              name: 'COUNT_IPS',
              unitCost: 250.0,
              margin: 20,
            },
            {
              name: 'EMAIL_VALIDATE',
              unitCost: 0.002,
              margin: 20,
            },
          ],
          isLoadConfig: false,
        });
      }

      if (accountDto.accountConfigs && accountDto.accountConfigs.length > 0) {
        await this.createOrUpdateAccountsConfigs(account.id, accountDto.accountConfigs);
      }

      if (!skipDefaults) {
        // create default custom-fields
        accountDto.customFields = [
          {
            title: 'utm_campaign',
            name: 'UTM_CAMPAIGN',
          },
          {
            title: 'utm_content',
            name: 'UTM_CONTENT',
          },
          {
            title: 'utm_medium',
            name: 'UTM_MEDIUM',
          },
          {
            title: 'utm_source',
            name: 'UTM_SOURCE',
          },
          {
            title: 'utm_term',
            name: 'UTM_TERM',
          },
          {
            title: 'last-visited-url',
            name: 'LAST-VISITED-URL',
          },
          {
            title: 'retargeting-product-name',
            name: 'RETARGETING-PRODUCT-NAME',
          },
          {
            title: 'retargeting-target-url',
            name: 'RETARGETING-TARGET-URL',
          },
          {
            title: 'placement',
            name: 'PLACEMENT',
          },
          {
            title: 'user_agent',
            name: 'USER_AGENT',
          },
          {
            title: 'fbclid',
            name: 'FBCLID',
          },
          {
            title: 'gclid',
            name: 'GCLID',
          },
          {
            title: 'adgroup_id',
            name: 'ADGROUP_ID',
          },
          {
            title: 'adset_id',
            name: 'ADSET_ID',
          },
          {
            title: 'app',
            name: 'APP',
          },
          {
            title: 'campaign_id',
            name: 'CAMPAIGN_ID',
          },
          {
            title: 'conversion_device',
            name: 'CONVERSION_DEVICE',
          },
        ];

        await this.createOrUpdateCustomFields(account.id, accountDto.customFields);
      } // close: if (!skipDefaults) custom-fields block
      await this.permissionsUserAccounts(account.id, userId, true);

      try {
        await this.uploadWebPushFile(account.id);
      } catch (err) {
        console.error('Account created, but uploadWebPushFile failed (non-fatal):', err);
      }

      try {
        const minute = Math.floor(Math.random() * (40 - 1 + 1) + 1);
        const dateSchedule = dayjs().tz('America/Sao_Paulo').add(24, 'hour').set('minute', minute).format('YYYY-MM-DD HH:mm:ss');
        const currentDate = dayjs().tz('America/Sao_Paulo').format('YYYY-MM-DD');
        await this.scheduler.create(`${account.id}/${currentDate}`, new Date(dateSchedule), `${process.env.BRIUS_HOSTURL}/statistics/usage`, QUEUE_BMS_USAGE);
      } catch (err) {
        console.error('Account created, but billing task scheduling failed (non-fatal):', err);
      }

      return { account: accountEntity, dns };
    } catch (e) {
      console.error(e);
      if (e instanceof HttpException) throw e;
      // Postgres unique_violation
      if ((e as any)?.code === '23505') {
        const detail = (e as any).detail || 'Resource already exists';
        throw new HttpException(detail, HttpStatus.CONFLICT);
      }
      // Postgres foreign_key_violation
      if ((e as any)?.code === '23503') {
        throw new HttpException((e as any).detail || 'Invalid reference', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException((e as Error)?.message || 'Failed to create account', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async uploadWebPushFile(accountId: number, content = '') {
    const assetsUrl = await this.storage.getAssetsUrl();
    const bucket = await this.storage.getDefaultBucket();
    if (!assetsUrl) {
      throw new HttpException('BMS_ASSETS_URL não configurado em /super-admin/integrations/s3 — Service Worker requer host público.', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const fileName = `bmspush-${createHash('sha256').update(`${accountId}`).digest('hex')}.js`;
    const fileContent = `
      var last_updated = "${Date.now()}";
      importScripts("https://${assetsUrl}/bms/bms-sw.js?t=" + last_updated);
      ${content}
    `;

    const fileDTO = {
      name: fileName,
      ext: `.js`,
      mime: 'application/javascript',
      content: fileContent,
      hash: createHash('md5').update(fileName).digest('hex'),
      path: 'bms/push',
      cacheControl: 'no-store',
    };

    await this.storage.genericUpload(fileDTO, fileName, 'bms/push', bucket, true);

    return this.clearCloudFlareCache(`https://${assetsUrl}/bms/push/${fileName}`);
  }

  async sendPushRulesToCloudflareWorkers(accountId: number, config: any) {
    if (!config) {
      return;
    }

    async function requestPost(apiKey: string, rules: object) {
      const url = process.env.CLOUDFLARE_PUSH_WORKERS_URL;

      const payload = {
        apikey: apiKey,
        ...rules,
      };

      await this.httpService
        .post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Management-Secret': process.env.CLOUDFLARE_PUSH_WORKERS_SECRET,
          },
        })
        .toPromise();
    }

    try {
      const parsed = JSON.parse(config);
      const pushRules = {
        urlFilterShow: parsed.urlFilterShow,
        urlFilterHide: parsed.urlFilterHide,
      };
      const apiKey = await this.findByAccountConfig(accountId, 'api_key');
      if (apiKey) {
        await requestPost.call(this, apiKey.value, pushRules);
        return;
      }

      const apiKeyTracker = await this.findByAccountConfig(accountId, 'api_key_tracker');
      if (apiKeyTracker) {
        await requestPost.call(this, apiKeyTracker.value, pushRules);
      }
    } catch (error) {
      console.error(`Error sending push rules to Cloudflare Workers for ${config}:`, error);
    }
  }

  async clearCloudFlareCache(fileUrl: string) {
    const url = `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`;

    const payload = {
      files: [fileUrl],
    };

    await this.httpService
      .post(url, payload, {
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();
  }

  // ── Web-Push per-account integration (Phase 2 — Enterprise-style UI) ───────
  // Single-project model: the account never configures Firebase. It just
  // downloads its service worker and pastes the autogenerated tracker snippet
  // (bmsTrkOptions, keyed by api_key + accountHash). Firebase/VAPID live in the
  // platform FCM config; the SW core is the shared bms-sw.js.

  async getWebPushIntegration(accountId: number): Promise<{
    serviceWorkerUrl: string | null;
    snippet: string;
    settings: any | null;
  }> {
    // Served by BMS itself (no public S3/CDN needed): GET /bms/push/:hash.js.
    const accountHashForUrl = createHash('sha256').update(`${accountId}`).digest('hex');
    const publicBase = (process.env.BMS_PUBLIC_URL || process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    const serviceWorkerUrl = publicBase ? `${publicBase}/bms/push/${accountHashForUrl}.js` : null;

    const [apiKeyRow, domainRow, settingsRow] = await Promise.all([
      this.findByAccountConfig(accountId, 'api_key'),
      this.findByAccountConfig(accountId, 'default_domain'),
      this.findByAccountConfig(accountId, 'webpush_settings'),
    ]);
    const apiKey = apiKeyRow?.value ?? '<API_KEY>';
    const accountHash = createHash('sha256').update(`${accountId}`).digest('hex');
    // cookieDomain: derive from the account's default domain (".example.com"),
    // matching the Enterprise snippet shape. Empty when no domain is set.
    let cookieDomain = '';
    try {
      if (domainRow?.value) cookieDomain = `.${new URL(domainRow.value).hostname.replace(/^www\./, '')}`;
    } catch {
      /* leave blank if not a valid URL */
    }
    // The tracker script (bmstrk.js) is an external asset. Prefer the configured
    // assets host if present; otherwise fall back to the known public CDN.
    const assetsUrl = await this.storage.getAssetsUrl().catch(() => undefined);
    const trackerScriptUrl = assetsUrl ? `https://${assetsUrl}/bms/bmstrk.js` : 'https://assets.bri.us/bms/bmstrk.js';

    const snippet = [
      '<script>',
      '  const bmsTrkOptions = {',
      "    bmsCookie: 'bmsInfo',",
      `    apiKey: '${apiKey}',`,
      `    cookieDomain: '${cookieDomain}',`,
      '    autoRequestContact: true,',
      '    startWebPush: true,',
      `    accountHash: '${accountHash}'`,
      '  };',
      '  window.bmsTrkOptions = bmsTrkOptions;',
      '</script>',
      `<script async="true" src="${trackerScriptUrl}"></script>`,
    ].join('\n');

    return { serviceWorkerUrl, snippet, settings: settingsRow?.value ? this.safeJsonParse(settingsRow.value) : null };
  }

  // Persists the web-push opt-in popup + URL filter settings (webpush_settings).
  // Reuses createOrUpdateAccountsConfigs which already regenerates the per-account
  // sw.js wrapper and pushes URL rules to Cloudflare.
  async saveWebPushSettings(accountId: number, settings: any): Promise<{ ok: true }> {
    await this.createOrUpdateAccountsConfigs(accountId, [{ name: 'webpush_settings', value: typeof settings === 'string' ? settings : JSON.stringify(settings) }]);
    return { ok: true };
  }

  // Resolve a public accountHash (sha256 of the id) back to an account id.
  // The hash isn't reversible and isn't indexed, so we hash each active account's
  // id and match. Cheap (sha256) and the set of accounts is small; result cached.
  private accountHashCache: Map<string, number> | null = null;
  async resolveAccountIdByHash(hash: string): Promise<number | null> {
    if (this.accountHashCache?.has(hash)) return this.accountHashCache.get(hash)!;
    const accounts = await this.getAllAccountsLightweight();
    const map = new Map<string, number>();
    for (const a of accounts) map.set(createHash('sha256').update(`${a.id}`).digest('hex'), a.id);
    this.accountHashCache = map;
    return map.get(hash) ?? null;
  }

  // Renders the account's web-push service worker ON THE FLY (no S3): platform
  // Firebase web config (from FCM system_config) + the account's opt-in vars.
  // Served by the public route GET /bms/push/:accountHash.js. Contains only
  // public values (web config, VAPID public key, tracker URL) — no secrets.
  async renderAccountServiceWorker(accountId: number): Promise<string> {
    // Platform web config lives in fcm_settings (system_config). Read it directly
    // to avoid a cross-module dependency on AdminFcmService.
    const fcm = await this.accountConfigRepository.manager.query(`SELECT value FROM system_config WHERE key = 'fcm_settings' LIMIT 1`).catch(() => []);
    const webConfig = fcm?.[0]?.value?.webConfig as Record<string, string> | undefined;
    const settingsRow = await this.findByAccountConfig(accountId, 'webpush_settings');
    const contentVars = settingsRow?.value ? this.parsePushContentVars(settingsRow.value) : '';
    const trackerUrl = process.env.WEB_PUSH_TRACKER_URL || `${process.env.BMS_PUBLIC_URL ?? ''}/bms/events?platform=web-push`;
    const { buildPlatformServiceWorker } = await import('../../lib/web-push-sw');
    const core = buildPlatformServiceWorker({ webConfig, trackerUrl });
    // Prepend the per-account opt-in vars (consumed by the on-page script).
    return [contentVars, core].filter(Boolean).join('\n');
  }

  // With the BMS-served (generate-on-request) SW, there is nothing to "publish":
  // the file is always rendered fresh from the latest config. This just returns
  // the current URL so the UI can confirm. Kept for API compatibility.
  async regenerateAccountServiceWorker(accountId: number): Promise<{ serviceWorkerUrl: string | null }> {
    const { serviceWorkerUrl } = await this.getWebPushIntegration(accountId);
    return { serviceWorkerUrl };
  }

  private safeJsonParse(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  async createAccountConfig(id: number, accountConfig: any) {
    const accountIdNameValue = accountConfig.map((accountConfig) => {
      return { accountId: id, name: Object.keys(accountConfig)[0], value: Object.values(accountConfig)[0] };
    });

    return await this.accountConfigRepository.createQueryBuilder('accounts_configs').insert().into('accounts_configs').values(accountIdNameValue).execute();
  }

  async permissionsUserAccounts(accountId: number, userId: number, isMaster: boolean) {
    const usersAccounts = { userId: userId, accountId: accountId, isMasterUser: isMaster };
    return await this.userAccountRepository.createQueryBuilder('users_accounts').insert().into('users_accounts').values(usersAccounts).execute();
  }

  async update(id: number, accountDto: CreateAccountDto): Promise<AccountEntity> {
    try {
      const account = await this.accountRepository.findOne({ where: { id } });
      this.accountRepository.merge(account, accountDto);
      delete account['accountConfigs'];
      delete account.customFields;
      delete account['accountHash']; // virtual property populated by @AfterLoad — not a real column
      const redisClient = await this.redisService.getClient();
      const redisKeys = await redisClient.keys(`automations_tag:${account.id}:*`);
      const deleteKeys = await redisKeys.map((key) => key);
      deleteKeys.push(`automations_push:${account.id}`);
      await redisClient.del(deleteKeys);
      await this.accountRepository.update(id, account);

      if (accountDto.customFields) {
        await this.createOrUpdateCustomFields(account.id, accountDto.customFields);
        // Invalidate account cache
        this.accountCacheService.invalidateAccountCacheAsync(account.id);
      }
      if (accountDto.accountConfigs) {
        await this.createOrUpdateAccountsConfigs(account.id, accountDto.accountConfigs);
      }

      return account;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async toggleSuspend(id: number, isActive: boolean): Promise<AccountEntity> {
    const account = await this.accountRepository.findOneOrFail({ where: { id } });
    account.isActive = isActive;
    return this.accountRepository.save(account);
  }

  async destroy(id: number) {
    try {
      await this.accountRepository.softDelete(id);
      return {
        statusCode: HttpStatus.OK,
        message: 'Account deleted successfully',
      };
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createOrUpdateCustomFields(id: number, CustomFieldsDto: any) {
    try {
      const customFields = CustomFieldsDto.map((customField) => {
        return {
          accountId: id.toString(),
          title: customField.title,
          name: customField.name,
          order: customField.order,
          description: customField.description ? customField.description : customField.name,
          type: 'text',
          attributionType: 'last',
        };
      });

      const result = await this.customFieldRepository
        .createQueryBuilder('customFields')
        .insert()
        .into(CustomFieldsEntity)
        .values(customFields)
        .orUpdate(['description', 'order', 'title'], ['account_id', 'name'])
        .execute();

      // Invalidate account cache after creating/updating custom fields
      this.accountCacheService.invalidateAccountCacheAsync(id);

      return result;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createOrUpdateAccountsConfigs(id: number, providerDto: any) {
    try {
      const accountProviders = [];
      for (const provider of providerDto) {
        provider.name = provider.name.toLowerCase();
        if (provider.name == 'webpush_settings') {
          provider.isLoadConfig = false;
          const contentVars = this.parsePushContentVars(provider.value);
          try {
            await this.uploadWebPushFile(id, contentVars);
          } catch (err) {
            console.error('webpush_settings: uploadWebPushFile failed (non-fatal):', err);
          }
          try {
            await this.sendPushRulesToCloudflareWorkers(id, provider.value);
          } catch (err) {
            console.error('webpush_settings: sendPushRulesToCloudflareWorkers failed (non-fatal):', err);
          }
        }

        // accounts_configs.value is a TEXT column. Pushing a JS object/array directly
        // makes the pg driver serialize it as a Postgres array literal (e.g. {"...","..."})
        // instead of a JSON string, breaking downstream JSON.parse callers. Always
        // stringify non-string values here so storage shape stays consistent.
        const value = typeof provider.value === 'string' || provider.value == null ? provider.value : JSON.stringify(provider.value);
        accountProviders.push({
          accountId: id.toString(),
          name: provider.name,
          value,
          description: provider.description,
          isLoadConfig: provider.isLoadConfig || true,
        });
      }

      // WhatsApp channel provisioning was previously done here via Evolution API
      // (legacy whatsapp_number_id / whatsapp_access_token in accounts_configs).
      // It now happens through POST /accounts/:id/whatsapp-channels (Wave 4) backed
      // by the new whatsapp_channels table.

      return await this.accountConfigRepository
        .createQueryBuilder('accounts_configs')
        .insert()
        .into(AccountConfigEntity)
        .values(accountProviders)
        .orUpdate(['value'], ['account_id', 'name'])
        .execute();
    } catch (e) {
      console.error(e);
      if (e instanceof HttpException) throw e;
      throw new HttpException((e as Error)?.message || 'Failed to update account configs', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  parsePushContentVars(values) {
    let varReturn = 'const webpush_settings_replace = {};';
    const deleteKeys = ['pushStyle', 'pushMobileStyle', 'scriptShowPush', 'mobileScriptShowPush'];
    if (typeof values === 'string') {
      values = JSON.parse(values);
    }

    Object.keys(values).forEach((key) => {
      if (!deleteKeys.includes(key)) {
        varReturn += `webpush_settings_replace.${key} =` + '`' + values[key] + '`;';
      }
    });

    return varReturn;
  }

  async getApiKeysByAccount(accountId: number, params: PageDto): Promise<PaginationDto<AccountConfigEntity>> {
    try {
      const [results, total] = await this.accountConfigRepository
        .createQueryBuilder('accounts_configs')
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .where('accounts_configs.account_id = :accountId', { accountId })
        .andWhere(`accounts_configs.name = 'api_key'`)
        .getManyAndCount();

      return new PaginationDto<AccountConfigEntity>({
        results: results,
        total,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteApiKeyByAccount(params: any) {
    try {
      await this.accountConfigRepository
        .createQueryBuilder('accounts_configs')
        .delete()
        .from(AccountConfigEntity)
        .where('account_id = :accountId AND value = :value AND description = :description', {
          accountId: params.accountId,
          value: params.value,
          description: params.description,
        })
        .execute();
      return {
        statusCode: HttpStatus.OK,
        message: 'Api Key deleted successfully',
      };
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  delay(time: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

  async findConfig(name: string, accountId?: number) {
    return await this.accountConfigRepository.find({
      where: {
        accountId: accountId ? accountId : this.cls.get('accountId'),
        name,
      },
    });
  }

  async getTimezone(accountId?: number): Promise<string> {
    const rows = await this.findConfig('time_zone', accountId);
    return rows[0]?.value ?? DEFAULT_ACCOUNT_TIMEZONE;
  }

  private async checkProviderCredentials(accountId: number, provider: string): Promise<boolean> {
    const PROVIDER_CREDENTIAL_KEYS: Record<string, string[]> = {
      sparkpost: ['sparkpost_key'],
      sendgrid: ['sendgrid_key'],
      mailersend: ['mailersend_key'],
      resend: ['resend_key'],
      ses: ['ses_access_key_id', 'ses_secret_access_key', 'ses_region'],
      mandrill: ['mandrill_key'],
    };

    const keys = PROVIDER_CREDENTIAL_KEYS[provider];
    if (!keys) return false;

    const rows = await this.accountConfigRepository.find({ where: { accountId, name: In(keys) } });
    return keys.every((key) => {
      const row = rows.find((r) => r.name === key);
      return !!row && typeof row.value === 'string' && row.value.trim().length > 0;
    });
  }

  async updateAccountConfig(name: string, accountConfig: { value: string; description?: string }) {
    if (name === 'default_email_provider') {
      const KNOWN_PROVIDERS = ['sparkpost', 'sendgrid', 'mailersend', 'resend', 'ses', 'mandrill'];
      const providerLabel = (v: string): string => {
        switch (v) {
          case 'sparkpost':
            return 'SparkPost';
          case 'sendgrid':
            return 'SendGrid';
          case 'mailersend':
            return 'MailerSend';
          case 'resend':
            return 'Resend';
          case 'ses':
            return 'Amazon SES';
          case 'mandrill':
            return 'Mandrill';
          default:
            return v;
        }
      };
      const value = accountConfig.value;
      if (KNOWN_PROVIDERS.includes(value)) {
        const accountId = this.cls.get('accountId');
        const ok = await this.checkProviderCredentials(accountId, value);
        if (!ok) {
          throw new BadRequestException(`Configure as credenciais do ${providerLabel(value)} antes de defini-lo como default.`);
        }
      }
    }
    return await this.accountConfigRepository.update({ accountId: this.cls.get('accountId'), name }, accountConfig);
  }

  async getAccountsByWebpush() {
    const query = `SELECT account_id FROM accounts_configs WHERE name = 'webpush_settings' and (value::jsonb->'isActive')::bool = true`;
    return await this.accountConfigRepository.query(query);
  }

  async getActiveAccountIds() {
    // Move the time_zone filter into the LEFT JOIN's ON clause and COALESCE
    // the result so accounts without an explicit time_zone config still
    // qualify (default UTC). The previous form put the filter in WHERE,
    // turning the LEFT JOIN into an effective INNER JOIN and silently
    // excluding accounts from the statistics aggregation cron.
    return await this.accountRepository
      .createQueryBuilder('account')
      .leftJoin('account.accountConfigs', 'accountConfigs', 'accountConfigs.name = :name', { name: 'time_zone' })
      .where('account.is_active = true')
      .select(['account.id AS id', "COALESCE(accountConfigs.value, 'UTC') AS time_zone"])
      .getRawMany();
  }

  private hashManagedApiKey(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  async listManagedApiKeys(accountId: number, params: PageDto): Promise<PaginationDto<any>> {
    const page = Number(params?.page || 1);
    const itemsPerPage = Number(params?.itemsPerPage || 20);

    const [results, total] = await this.accountApiKeyRepository.findAndCount({
      where: { accountId },
      order: { id: 'DESC' },
      skip: (page - 1) * itemsPerPage,
      take: itemsPerPage,
    });

    return new PaginationDto<any>({
      results: results.map((item) => ({
        id: item.id,
        accountId: item.accountId,
        name: item.name,
        roleCode: item.role?.code || null,
        status: item.status,
        source: item.source,
        expiresAt: item.expiresAt,
        lastUsedAt: item.lastUsedAt,
        revokedAt: item.revokedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total,
      page,
      itemsPerPage,
    });
  }

  async createManagedApiKey(accountId: number, payload: { name?: string; roleCode?: string; expiresAt?: Date }, createdByUserId?: number) {
    const roleCode = payload?.roleCode || ROLE_CODES.ADMIN;
    if (roleCode === ROLE_CODES.SUPER_ADMIN) {
      throw new HttpException('API key cannot use super_admin role', HttpStatus.FORBIDDEN);
    }

    const role = await this.roleRepository.findOne({ where: { code: roleCode } });
    if (!role) {
      throw new HttpException('Role not found', HttpStatus.BAD_REQUEST);
    }

    const plainApiKey = `mk_${randomBytes(24).toString('hex')}`;
    const entity = this.accountApiKeyRepository.create({
      accountId,
      name: payload?.name || `api_key_${Date.now()}`,
      keyHash: this.hashManagedApiKey(plainApiKey),
      roleId: role.id,
      status: 'active',
      source: 'managed',
      expiresAt: payload?.expiresAt || null,
      createdByUserId: createdByUserId || null,
    });

    const saved = await this.accountApiKeyRepository.save(entity);

    return {
      id: saved.id,
      accountId: saved.accountId,
      name: saved.name,
      roleCode: role.code,
      status: saved.status,
      expiresAt: saved.expiresAt,
      source: saved.source,
      apiKey: plainApiKey,
    };
  }

  async updateManagedApiKey(accountId: number, keyId: number, payload: { name?: string; roleCode?: string; expiresAt?: Date | null }) {
    const apiKey = await this.accountApiKeyRepository.findOne({ where: { id: keyId, accountId } });
    if (!apiKey) {
      throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
    }

    if (payload?.roleCode) {
      if (payload.roleCode === ROLE_CODES.SUPER_ADMIN) {
        throw new HttpException('API key cannot use super_admin role', HttpStatus.FORBIDDEN);
      }

      const role = await this.roleRepository.findOne({ where: { code: payload.roleCode } });
      if (!role) {
        throw new HttpException('Role not found', HttpStatus.BAD_REQUEST);
      }

      apiKey.roleId = role.id;
    }

    if (payload?.name !== undefined) {
      apiKey.name = payload.name;
    }

    if (payload?.expiresAt !== undefined) {
      apiKey.expiresAt = payload.expiresAt as any;
    }

    await this.accountApiKeyRepository.save(apiKey);
    return this.accountApiKeyRepository.findOne({ where: { id: keyId, accountId } });
  }

  async rotateManagedApiKey(accountId: number, keyId: number) {
    const apiKey = await this.accountApiKeyRepository.findOne({ where: { id: keyId, accountId } });
    if (!apiKey) {
      throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
    }

    const plainApiKey = `mk_${randomBytes(24).toString('hex')}`;
    apiKey.keyHash = this.hashManagedApiKey(plainApiKey);
    apiKey.status = 'active';
    apiKey.revokedAt = null;
    await this.accountApiKeyRepository.save(apiKey);

    return {
      id: apiKey.id,
      accountId: apiKey.accountId,
      name: apiKey.name,
      apiKey: plainApiKey,
    };
  }

  async revokeManagedApiKey(accountId: number, keyId: number) {
    const apiKey = await this.accountApiKeyRepository.findOne({ where: { id: keyId, accountId } });
    if (!apiKey) {
      throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
    }

    apiKey.status = 'revoked';
    apiKey.revokedAt = new Date();
    await this.accountApiKeyRepository.save(apiKey);

    // Invalidate the authz cache so the key stops working immediately
    const cacheKey = `authz:apikey:${apiKey.keyHash}`;
    await this.redisService.getClient().del(cacheKey);

    return { revoked: true };
  }
}
