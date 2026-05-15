import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ClsService } from 'nestjs-cls';
import { AccountsService } from '../accounts.service';
import { AccountEntity } from '../../../entities/account.entity';
import { AccountConfigEntity } from '../../../entities/account-config.entity';
import { UserAccountEntity } from '../../../entities/users-account.entity';
import { CustomFieldsEntity } from '../../../entities/custom-fields.entity';
import { CustomEventEntity } from '../../../entities/custom-event.entity';
import { AccountApiKeyEntity } from '../../../entities/account-api-key.entity';
import { RoleEntity } from '../../../entities/role.entity';
import { RedisService } from '../../../providers/redis.provider';
import { SendgridHandler } from '../../../handlers/email/sendgrid/sendgrid.handler';
import { S3StorageProvider } from '../../../providers/s3-storage.provider';
import { SchedulerService } from 'src/providers/queue/scheduler.service';
import { EvolutionHandler } from 'src/handlers/evolution/evolution.handler';
import { AccountCacheService } from '../account-cache.service';

describe('AccountsService — findWithCleanConfigs', () => {
  let service: AccountsService;
  let accountRepository: { findOneOrFail: jest.Mock };
  let customFieldRepository: { find: jest.Mock };
  let accountConfigRepository: { find: jest.Mock };

  beforeEach(async () => {
    accountRepository = { findOneOrFail: jest.fn() };
    customFieldRepository = { find: jest.fn() };
    accountConfigRepository = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepository },
        { provide: getRepositoryToken(CustomFieldsEntity), useValue: customFieldRepository },
        { provide: getRepositoryToken(CustomEventEntity), useValue: {} },
        { provide: getRepositoryToken(AccountConfigEntity), useValue: accountConfigRepository },
        { provide: getRepositoryToken(UserAccountEntity), useValue: {} },
        { provide: getRepositoryToken(AccountApiKeyEntity), useValue: {} },
        { provide: getRepositoryToken(RoleEntity), useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: SendgridHandler, useValue: {} },
        { provide: S3StorageProvider, useValue: {} },
        { provide: SchedulerService, useValue: {} },
        { provide: ClsService, useValue: { get: jest.fn() } },
        { provide: HttpService, useValue: {} },
        { provide: EvolutionHandler, useValue: {} },
        { provide: AccountCacheService, useValue: {} },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('preserves isInternal on the returned account (true)', async () => {
    const account = Object.assign(new AccountEntity(), {
      id: 42,
      name: 'Internal Account',
      isActive: true,
      isInternal: true,
      groupId: 1,
    });
    accountRepository.findOneOrFail.mockResolvedValue(account);
    customFieldRepository.find.mockResolvedValue([]);
    accountConfigRepository.find.mockResolvedValue([]);

    const result = await service.findWithCleanConfigs(42);

    expect(result).toBeDefined();
    expect(result.isInternal).toBe(true);
    expect(result.id).toBe(42);
  });

  it('preserves isInternal on the returned account (false)', async () => {
    const account = Object.assign(new AccountEntity(), {
      id: 7,
      name: 'External Account',
      isActive: true,
      isInternal: false,
      groupId: 1,
    });
    accountRepository.findOneOrFail.mockResolvedValue(account);
    customFieldRepository.find.mockResolvedValue([]);
    accountConfigRepository.find.mockResolvedValue([]);

    const result = await service.findWithCleanConfigs(7);

    expect(result.isInternal).toBe(false);
  });

  it('replaces customFields and accountConfigs but does not strip isInternal', async () => {
    const account = Object.assign(new AccountEntity(), {
      id: 99,
      name: 'Another Account',
      isActive: true,
      isInternal: true,
      groupId: 2,
      customFields: [{ name: 'stale' } as unknown as CustomFieldsEntity],
      accountConfigs: [{ name: 'stale' } as unknown as AccountConfigEntity],
    });
    const loadedFields = [{ name: 'fresh' } as unknown as CustomFieldsEntity];
    const loadedConfigs = [{ name: 'fresh', isLoadConfig: true } as unknown as AccountConfigEntity];

    accountRepository.findOneOrFail.mockResolvedValue(account);
    customFieldRepository.find.mockResolvedValue(loadedFields);
    accountConfigRepository.find.mockResolvedValue(loadedConfigs);

    const result = await service.findWithCleanConfigs(99);

    expect(result.isInternal).toBe(true);
    expect(result.customFields).toBe(loadedFields);
    expect(result.accountConfigs).toBe(loadedConfigs);
  });
});

describe('AccountsService — updateAccountConfig — default_email_provider cross-field validation', () => {
  let service: AccountsService;
  let accountConfigRepository: { find: jest.Mock; update: jest.Mock };
  let clsService: { get: jest.Mock };

  const ACCOUNT_ID = 42;

  const buildRow = (name: string, value: string) => ({ accountId: ACCOUNT_ID, name, value }) as unknown as AccountConfigEntity;

  beforeEach(async () => {
    accountConfigRepository = {
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    clsService = { get: jest.fn().mockReturnValue(ACCOUNT_ID) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: getRepositoryToken(AccountEntity), useValue: {} },
        { provide: getRepositoryToken(CustomFieldsEntity), useValue: {} },
        { provide: getRepositoryToken(CustomEventEntity), useValue: {} },
        { provide: getRepositoryToken(AccountConfigEntity), useValue: accountConfigRepository },
        { provide: getRepositoryToken(UserAccountEntity), useValue: {} },
        { provide: getRepositoryToken(AccountApiKeyEntity), useValue: {} },
        { provide: getRepositoryToken(RoleEntity), useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: SendgridHandler, useValue: {} },
        { provide: S3StorageProvider, useValue: {} },
        { provide: SchedulerService, useValue: {} },
        { provide: ClsService, useValue: clsService },
        { provide: HttpService, useValue: {} },
        { provide: EvolutionHandler, useValue: {} },
        { provide: AccountCacheService, useValue: {} },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  describe.each([
    ['sparkpost', 'SparkPost', ['sparkpost_key']],
    ['sendgrid', 'SendGrid', ['sendgrid_key']],
    ['mailersend', 'MailerSend', ['mailersend_key']],
    ['resend', 'Resend', ['resend_key']],
    ['mandrill', 'Mandrill', ['mandrill_key']],
  ])('provider %s', (providerName, providerLabel, keys) => {
    it(`resolves when ${keys.join(', ')} is configured`, async () => {
      accountConfigRepository.find.mockResolvedValue(keys.map((k) => buildRow(k, 'secret-value')));

      await expect(service.updateAccountConfig('default_email_provider', { value: providerName })).resolves.toBeDefined();
      expect(accountConfigRepository.update).toHaveBeenCalledWith({ accountId: ACCOUNT_ID, name: 'default_email_provider' }, { value: providerName });
    });

    it(`rejects with BadRequestException when credentials missing`, async () => {
      accountConfigRepository.find.mockResolvedValue([]);

      await expect(service.updateAccountConfig('default_email_provider', { value: providerName })).rejects.toMatchObject({
        message: expect.stringMatching(/Configure as credenciais do .* antes de defini-lo como default\./),
      });
      await expect(service.updateAccountConfig('default_email_provider', { value: providerName })).rejects.toMatchObject({
        message: expect.stringContaining(providerLabel),
      });
      expect(accountConfigRepository.update).not.toHaveBeenCalled();
    });

    it(`rejects when credential row exists but value is empty/whitespace`, async () => {
      accountConfigRepository.find.mockResolvedValue(keys.map((k) => buildRow(k, '   ')));

      await expect(service.updateAccountConfig('default_email_provider', { value: providerName })).rejects.toMatchObject({
        message: expect.stringContaining(providerLabel),
      });
      expect(accountConfigRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('provider ses (3 required keys)', () => {
    const SES_KEYS = ['ses_access_key_id', 'ses_secret_access_key', 'ses_region'];

    it('resolves when all 3 SES keys are configured', async () => {
      accountConfigRepository.find.mockResolvedValue(SES_KEYS.map((k) => buildRow(k, 'value')));

      await expect(service.updateAccountConfig('default_email_provider', { value: 'ses' })).resolves.toBeDefined();
      expect(accountConfigRepository.update).toHaveBeenCalled();
    });

    it.each(SES_KEYS)('rejects when SES key %s is missing', async (missingKey) => {
      const present = SES_KEYS.filter((k) => k !== missingKey).map((k) => buildRow(k, 'value'));
      accountConfigRepository.find.mockResolvedValue(present);

      await expect(service.updateAccountConfig('default_email_provider', { value: 'ses' })).rejects.toMatchObject({
        message: expect.stringContaining('Amazon SES'),
      });
      expect(accountConfigRepository.update).not.toHaveBeenCalled();
    });
  });

  it('does NOT invoke checkProviderCredentials for unrelated config names', async () => {
    await service.updateAccountConfig('default_domain', { value: 'example.com' });
    expect(accountConfigRepository.find).not.toHaveBeenCalled();
    expect(accountConfigRepository.update).toHaveBeenCalledWith({ accountId: ACCOUNT_ID, name: 'default_domain' }, { value: 'example.com' });
  });

  it('does NOT invoke checkProviderCredentials for unknown provider values (preserves behavior)', async () => {
    await service.updateAccountConfig('default_email_provider', { value: 'unknown_provider' });
    expect(accountConfigRepository.find).not.toHaveBeenCalled();
    expect(accountConfigRepository.update).toHaveBeenCalled();
  });
});

// SkipDefaults bypassa custom fields/events default + scheduler de
// billing + account_configs (api_key_tracker, account_costs). Mantém só o
// insert principal, link users_account e tentativa de upload S3.
describe('AccountsService.create — skipDefaults', () => {
  let service: AccountsService;
  let accountRepository: any;
  let accountConfigRepository: any;
  let customFieldRepository: any;
  let customEventRepository: any;
  let userAccountRepository: any;
  let storage: any;
  let scheduler: any;

  beforeEach(async () => {
    accountRepository = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn(async (acc) => ({ ...acc, id: 123 })),
    };
    accountConfigRepository = { createQueryBuilder: jest.fn() };
    customFieldRepository = { createQueryBuilder: jest.fn() };
    customEventRepository = { createQueryBuilder: jest.fn() };
    userAccountRepository = {
      createQueryBuilder: jest.fn(() => ({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      })),
    };
    storage = {
      getAssetsUrl: jest.fn().mockResolvedValue(null),
      getDefaultBucket: jest.fn().mockResolvedValue(null),
      genericUpload: jest.fn(),
    };
    scheduler = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepository },
        { provide: getRepositoryToken(CustomFieldsEntity), useValue: customFieldRepository },
        { provide: getRepositoryToken(CustomEventEntity), useValue: customEventRepository },
        { provide: getRepositoryToken(AccountConfigEntity), useValue: accountConfigRepository },
        { provide: getRepositoryToken(UserAccountEntity), useValue: userAccountRepository },
        { provide: getRepositoryToken(AccountApiKeyEntity), useValue: {} },
        { provide: getRepositoryToken(RoleEntity), useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: SendgridHandler, useValue: {} },
        { provide: S3StorageProvider, useValue: storage },
        { provide: SchedulerService, useValue: scheduler },
        { provide: ClsService, useValue: { get: jest.fn() } },
        { provide: HttpService, useValue: {} },
        { provide: EvolutionHandler, useValue: {} },
        { provide: AccountCacheService, useValue: { invalidateAccountCacheAsync: jest.fn() } },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('com skipDefaults:true NÃO insere custom fields, custom events nem chama scheduler', async () => {
    const customFieldsSpy = jest.spyOn(service as any, 'createOrUpdateCustomFields').mockResolvedValue({});
    const customEventsSpy = jest.spyOn(service as any, 'createOrUpdateCustomEvents').mockResolvedValue({});
    const accountConfigsSpy = jest.spyOn(service as any, 'createOrUpdateAccountsConfigs').mockResolvedValue({});
    const permissionsSpy = jest.spyOn(service as any, 'permissionsUserAccounts').mockResolvedValue({});

    await service.create({ name: 'X' } as any, 1, { skipDefaults: true });

    expect(accountRepository.save).toHaveBeenCalled();
    expect(permissionsSpy).toHaveBeenCalled(); // user-account link sempre acontece
    expect(customFieldsSpy).not.toHaveBeenCalled();
    expect(customEventsSpy).not.toHaveBeenCalled();
    expect(accountConfigsSpy).not.toHaveBeenCalled();
    expect(scheduler.create).not.toHaveBeenCalled();
  });

  it('comportamento default (sem opts) preserva inserts default', async () => {
    const customFieldsSpy = jest.spyOn(service as any, 'createOrUpdateCustomFields').mockResolvedValue({});
    const customEventsSpy = jest.spyOn(service as any, 'createOrUpdateCustomEvents').mockResolvedValue({});
    const accountConfigsSpy = jest.spyOn(service as any, 'createOrUpdateAccountsConfigs').mockResolvedValue({});
    jest.spyOn(service as any, 'permissionsUserAccounts').mockResolvedValue({});

    await service.create({ name: 'X' } as any, 1);

    expect(customFieldsSpy).toHaveBeenCalled();
    expect(customEventsSpy).toHaveBeenCalled();
    expect(accountConfigsSpy).toHaveBeenCalled();
  });
});
