import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MsgopsService } from './msgops.service';
import { AccountEntity } from './entities/account.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { EmailValidateEntity } from './entities/email-validate.entity';
import { AccountUsageEntity } from './entities/account-usage.entity';
import { AccountApiKeyEntity } from './entities/account-api-key.entity';
import { RedisService } from '../providers/redis/redis.service';

describe('MsgopsService', () => {
  let service: MsgopsService;
  let mockRedis: Record<string, jest.Mock>;
  let mockAccountRepo: Record<string, jest.Mock>;
  let mockAccountConfigRepo: Record<string, jest.Mock>;
  let mockEmailValidateRepo: Record<string, jest.Mock>;
  let mockAccountUsageRepo: any;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
    };

    mockAccountRepo = {
      create: jest.fn((data) => data),
      findOneBy: jest.fn(),
    };

    mockAccountConfigRepo = {
      findOne: jest.fn(),
    };

    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    mockEmailValidateRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockAccountUsageRepo = {
      manager: {
        query: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MsgopsService,
        {
          provide: getRepositoryToken(AccountEntity),
          useValue: mockAccountRepo,
        },
        {
          provide: getRepositoryToken(AccountConfigEntity),
          useValue: mockAccountConfigRepo,
        },
        {
          provide: getRepositoryToken(AccountApiKeyEntity),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(EmailValidateEntity),
          useValue: mockEmailValidateRepo,
        },
        {
          provide: getRepositoryToken(AccountUsageEntity),
          useValue: mockAccountUsageRepo,
        },
        {
          provide: RedisService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(mockRedis),
          },
        },
      ],
    }).compile();

    service = module.get<MsgopsService>(MsgopsService);
  });

  describe('findAccountByApiKey()', () => {
    it('should return undefined for empty apiKey', async () => {
      const result = await service.findAccountByApiKey('');
      expect(result).toBeUndefined();
    });

    it('should return undefined for null apiKey', async () => {
      const result = await service.findAccountByApiKey(null);
      expect(result).toBeUndefined();
    });

    it('should return cached account from Redis', async () => {
      const account = { id: 1, name: 'Test Account' };
      mockRedis.get.mockResolvedValue(JSON.stringify(account));

      const result = await service.findAccountByApiKey('test-key');

      expect(result).toEqual(account);
      expect(mockAccountConfigRepo.findOne).not.toHaveBeenCalled();
    });

    it('should look up account from DB when Redis cache misses', async () => {
      mockRedis.get.mockResolvedValue(null);

      const accountConfig = { accountId: 1, name: 'api_key', value: 'test-key' };
      const account = { id: 1, name: 'Test Account' };

      mockAccountConfigRepo.findOne.mockResolvedValue(accountConfig);
      mockAccountRepo.findOneBy.mockResolvedValue(account);

      const result = await service.findAccountByApiKey('test-key');

      expect(result).toEqual(account);
      expect(mockAccountConfigRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['account'],
          where: expect.arrayContaining([expect.objectContaining({ name: 'api_key', value: 'test-key' }), expect.objectContaining({ name: 'api_key_tracker', value: 'test-key' })]),
        }),
      );
    });

    it('should cache account in Redis after DB lookup', async () => {
      mockRedis.get.mockResolvedValue(null);

      const accountConfig = { accountId: 1 };
      const account = { id: 1, name: 'Test Account' };

      mockAccountConfigRepo.findOne.mockResolvedValue(accountConfig);
      mockAccountRepo.findOneBy.mockResolvedValue(account);

      await service.findAccountByApiKey('test-key');

      const expectedKey = `account:${Buffer.from('test-key').toString('base64')}`;
      expect(mockRedis.set).toHaveBeenCalledWith(expectedKey, JSON.stringify(account));
    });

    it('should return undefined when account config not found in DB', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockAccountConfigRepo.findOne.mockResolvedValue(null);

      const result = await service.findAccountByApiKey('unknown-key');

      expect(result).toBeUndefined();
    });

    it('should use relations instead of deprecated join option', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockAccountConfigRepo.findOne.mockResolvedValue(null);

      await service.findAccountByApiKey('test-key');

      expect(mockAccountConfigRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['account'],
        }),
      );
      // Verify no join option is present
      const callArgs = mockAccountConfigRepo.findOne.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('join');
    });
  });

  describe('findByEmail()', () => {
    it('should query email validations with 7 day window', async () => {
      const qb = mockEmailValidateRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue({ email: 'test@example.com', status: 'deliverable' });

      const result = await service.findByEmail('test@example.com');

      expect(result).toBeDefined();
      expect(mockEmailValidateRepo.createQueryBuilder).toHaveBeenCalledWith('email_validations');
    });

    it('should return null when no cached email found', async () => {
      const qb = mockEmailValidateRepo.createQueryBuilder();
      qb.getOne.mockResolvedValue(null);

      const result = await service.findByEmail('new@example.com');

      expect(result).toBeNull();
    });
  });

  describe('createOrUpdateAccountUsage()', () => {
    it('should execute upsert query for account usage', async () => {
      await service.createOrUpdateAccountUsage(1);

      expect(mockAccountUsageRepo.manager.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO accounts_usages'));
      expect(mockAccountUsageRepo.manager.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'));
    });
  });

  describe('createOrUpdateEmail()', () => {
    it('should upsert email validation record', async () => {
      const emailValidate: any = {
        email: 'test@example.com',
        reason: 'accepted_email',
        status: 'deliverable',
        response: '{}',
      };

      const qb = mockEmailValidateRepo.createQueryBuilder();
      qb.execute.mockResolvedValue({ affected: 1 });

      await service.createOrUpdateEmail(emailValidate);

      expect(emailValidate.updatedAt).toBeDefined();
      expect(qb.insert).toHaveBeenCalled();
      expect(qb.orUpdate).toHaveBeenCalledWith(['reason', 'response', 'status', 'updated_at'], ['email']);
    });
  });
});
