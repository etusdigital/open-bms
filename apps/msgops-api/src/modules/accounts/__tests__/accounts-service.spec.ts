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
import { GoogleCloudStorageProvider } from '../../../providers/google-cloud-storage.provider';
import { GoogleTasksProvider } from 'src/providers/google-tasks.provider';
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
        { provide: GoogleCloudStorageProvider, useValue: {} },
        { provide: GoogleTasksProvider, useValue: {} },
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
