import { randomBytes } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EnterpriseImportService } from '../enterprise-import.service';
import { EnterpriseImportJobEntity } from '../../../entities/enterprise-import-job.entity';
import { QUEUE_ENTERPRISE_IMPORT } from '../../../providers/queue/queue.constants';
import { AccountsService } from '../../accounts/accounts.service';
import { _resetEncryptionKeyCache } from '../../../utils/api-key-encryption.util';

describe('EnterpriseImportService', () => {
  let service: EnterpriseImportService;
  let jobRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock; manager: { transaction: jest.Mock } };
  let queue: { add: jest.Mock; obliterate: jest.Mock };
  let accountsService: {
    create: jest.Mock;
    findOne: jest.Mock;
    findByName: jest.Mock;
    restoreAccount: jest.Mock;
    createAccountConfig: jest.Mock;
    createManagedApiKey: jest.Mock;
  };
  let em: { query: jest.Mock };

  beforeAll(() => {
    process.env.ENTERPRISE_IMPORT_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    _resetEncryptionKeyCache();
  });

  beforeEach(async () => {
    em = {
      query: jest.fn(async (sql: string) => {
        if (/^SELECT DISTINCT account_id/.test(sql)) return [{ account_id: 88 }];
        if (/RETURNING id/.test(sql)) return [{ id: 1 }];
        return [];
      }),
    };
    jobRepo = {
      findOne: jest.fn(),
      create: jest.fn((payload) => ({ ...payload, id: 'job-uuid' })),
      save: jest.fn(async (j) => ({ ...j, id: j.id ?? 'job-uuid' })),
      update: jest.fn(),
      manager: { transaction: jest.fn(async (cb: any) => cb(em)) },
    };
    queue = { add: jest.fn().mockResolvedValue(undefined), obliterate: jest.fn().mockResolvedValue(undefined) };
    accountsService = {
      create: jest.fn().mockResolvedValue({ account: { id: 99 } }),
      findOne: jest.fn().mockResolvedValue({ id: 42 }),
      findByName: jest.fn().mockResolvedValue(null),
      restoreAccount: jest.fn().mockResolvedValue(undefined),
      createAccountConfig: jest.fn().mockResolvedValue(undefined),
      createManagedApiKey: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnterpriseImportService,
        { provide: getRepositoryToken(EnterpriseImportJobEntity), useValue: jobRepo },
        { provide: getQueueToken(QUEUE_ENTERPRISE_IMPORT), useValue: queue },
        { provide: AccountsService, useValue: accountsService },
      ],
    }).compile();

    service = module.get<EnterpriseImportService>(EnterpriseImportService);
  });

  describe('createAccountImport', () => {
    it('creates account with skipDefaults:true, persists job and enqueues', async () => {
      jobRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.createAccountImport(
        {
          accountData: { name: 'Cliente X' } as any,
          enterpriseBaseUrl: 'https://api.enterprise.example.com',
          enterpriseApiKey: 'secret-key-1234',
        },
        7,
      );

      expect(accountsService.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cliente X' }), 7, { skipDefaults: true });
      expect(jobRepo.save).toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith('import', { jobId: 'job-uuid' }, expect.any(Object));
      expect(result).toEqual({ accountId: 99, jobId: 'job-uuid' });
    });

    it('idempotent: active (running) job for same account returns the same jobId without duplicating', async () => {
      jobRepo.findOne.mockResolvedValueOnce({ id: 'job-running', status: 'running' });
      const result = await service.createAccountImport({ accountData: { name: 'X' } as any, enterpriseBaseUrl: 'https://x', enterpriseApiKey: 'aaaaaaaa' }, 1);
      expect(result).toEqual({ accountId: 99, jobId: 'job-running' });
      expect(jobRepo.save).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('idempotent: failed job for same account resumes (reuses the row, re-enqueues)', async () => {
      const failed = { id: 'job-failed', status: 'failed', encryptedApiKey: 'old', error: 'boom', createdBy: 1 };
      jobRepo.findOne.mockResolvedValueOnce(failed);
      const result = await service.createAccountImport({ accountData: { name: 'X' } as any, enterpriseBaseUrl: 'https://x', enterpriseApiKey: 'newkey1234' }, 1);
      expect(result).toEqual({ accountId: 99, jobId: 'job-failed' });
      const saved = jobRepo.save.mock.calls[0][0];
      expect(saved.id).toBe('job-failed');
      expect(saved.status).toBe('pending');
      expect(saved.error).toBeNull();
      expect(saved.encryptedApiKey).not.toBe('old');
      expect(queue.add).toHaveBeenCalledWith('import', { jobId: 'job-failed' }, expect.any(Object));
    });

    it('idempotent: account already exists (by name) reuses it, does not call accounts.create', async () => {
      accountsService.findByName.mockResolvedValueOnce({ id: 77 });
      jobRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.createAccountImport({ accountData: { name: 'Cliente X' } as any, enterpriseBaseUrl: 'https://x', enterpriseApiKey: 'aaaaaaaa' }, 1);
      expect(accountsService.create).not.toHaveBeenCalled();
      expect(accountsService.createManagedApiKey).not.toHaveBeenCalled();
      expect(result.accountId).toBe(77);
      expect(queue.add).toHaveBeenCalled();
    });

    it('idempotent: soft-deleted orphan account is restored and reused (no recreate, avoids 23505)', async () => {
      accountsService.findByName.mockResolvedValueOnce({ id: 88, deletedAt: new Date() });
      jobRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.createAccountImport({ accountData: { name: 'BMS' } as any, enterpriseBaseUrl: 'https://x', enterpriseApiKey: 'aaaaaaaa' }, 1);
      expect(accountsService.findByName).toHaveBeenCalledWith('BMS', { withDeleted: true });
      expect(accountsService.restoreAccount).toHaveBeenCalledWith(88);
      expect(accountsService.create).not.toHaveBeenCalled();
      expect(result.accountId).toBe(88);
      expect(queue.add).toHaveBeenCalled();
    });
  });

  describe('createAccountImportForExistingAccount', () => {
    it('imports into the existing account without create/find-by-name and enqueues a new job', async () => {
      jobRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.createAccountImportForExistingAccount(42, { enterpriseBaseUrl: 'https://api.enterprise.example.com', enterpriseApiKey: 'secret-key-1234' }, 7);
      expect(accountsService.findOne).toHaveBeenCalledWith(42);
      expect(accountsService.create).not.toHaveBeenCalled();
      expect(accountsService.findByName).not.toHaveBeenCalled();
      expect(accountsService.createManagedApiKey).not.toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith('import', { jobId: 'job-uuid' }, expect.any(Object));
      expect(result).toEqual({ accountId: 42, jobId: 'job-uuid' });
    });

    it('idempotent: job already active (running) for the account returns same jobId, no duplicate', async () => {
      jobRepo.findOne.mockResolvedValueOnce({ id: 'job-running', status: 'running' });
      const result = await service.createAccountImportForExistingAccount(42, { enterpriseBaseUrl: 'https://x', enterpriseApiKey: 'aaaaaaaa' }, 1);
      expect(result).toEqual({ accountId: 42, jobId: 'job-running' });
      expect(jobRepo.save).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('propagates 404 when the account does not exist (server-side defense)', async () => {
      accountsService.findOne.mockRejectedValueOnce(new NotFoundException('Account not found'));
      await expect(service.createAccountImportForExistingAccount(123, { enterpriseBaseUrl: 'https://x', enterpriseApiKey: 'aaaaaaaa' }, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('resetForSetup', () => {
    it('obliterates the queue BEFORE deleting, removes non-cascade children + account + jobs', async () => {
      const res = await service.resetForSetup();

      expect(queue.obliterate).toHaveBeenCalledWith({ force: true });
      const sqls = em.query.mock.calls.map((c) => String(c[0]));
      // order: collect ids -> automations_targets -> labels -> accounts -> jobs
      expect(sqls[0]).toMatch(/SELECT DISTINCT account_id/);
      expect(sqls.some((s) => /DELETE FROM automations_targets/.test(s))).toBe(true);
      expect(sqls.some((s) => /DELETE FROM labels/.test(s))).toBe(true);
      expect(sqls.some((s) => /DELETE FROM accounts WHERE id = ANY/.test(s))).toBe(true);
      expect(sqls.some((s) => /DELETE FROM enterprise_import_jobs WHERE scope = 'account'/.test(s))).toBe(true);
      expect(res).toEqual({ accountsDeleted: 1, jobsDeleted: 1 });
    });

    it('includes extraAccountIds (accountId from enterprise_import_done) even without a job', async () => {
      em.query.mockImplementation(async (sql: string) => {
        if (/^SELECT DISTINCT account_id/.test(sql)) return []; // no job
        if (/RETURNING id/.test(sql)) return [{ id: 7 }];
        return [];
      });
      const res = await service.resetForSetup([7]);
      const accountsDel = em.query.mock.calls.find((c) => /DELETE FROM accounts WHERE id = ANY/.test(String(c[0])));
      expect(accountsDel?.[1]).toEqual([[7]]);
      expect(res.accountsDeleted).toBe(1);
    });

    it('queue obliterate failure does not abort the data cleanup', async () => {
      queue.obliterate.mockRejectedValueOnce(new Error('redis down'));
      const res = await service.resetForSetup();
      expect(em.query).toHaveBeenCalled();
      expect(res.jobsDeleted).toBe(1);
    });
  });

  describe('getStatus', () => {
    it('returns ImportStatusDto without apiKey', async () => {
      const job = {
        id: 'jid',
        accountId: 5,
        scope: 'account',
        status: 'running',
        enterpriseBaseUrl: 'https://x',
        encryptedApiKey: 'cipher-blob',
        progress: { tags: { done: 5, total: 10, page: 1 } },
        checkpoint: { entity: 'tags', page: 1 },
        error: null,
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        finishedAt: null,
      };
      jobRepo.findOne.mockResolvedValueOnce(job);
      const status = await service.getStatus('jid');
      expect(status).not.toHaveProperty('encryptedApiKey');
      expect(status.jobId).toBe('jid');
      expect(status.progress).toEqual(job.progress);
    });

    it('404 when jobId does not exist', async () => {
      jobRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getStatus('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resume', () => {
    it('re-enqueues a job in status=failed', async () => {
      const job = { id: 'j1', status: 'failed', encryptedApiKey: 'old-cipher', error: 'boom' };
      jobRepo.findOne.mockResolvedValueOnce(job);
      await service.resume('j1');
      expect(queue.add).toHaveBeenCalled();
      expect(jobRepo.save).toHaveBeenCalled();
    });

    it('rejects with 409 if status=running', async () => {
      jobRepo.findOne.mockResolvedValueOnce({ id: 'j1', status: 'running' });
      await expect(service.resume('j1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('accepts a new apiKey in the body and re-encrypts', async () => {
      const job = { id: 'j1', status: 'failed', encryptedApiKey: 'old-cipher' };
      jobRepo.findOne.mockResolvedValueOnce(job);
      await service.resume('j1', 'novachave1234');
      // save must have been called with a changed encryptedApiKey
      const savedArg = jobRepo.save.mock.calls[0][0];
      expect(savedArg.encryptedApiKey).toBeTruthy();
      expect(savedArg.encryptedApiKey).not.toBe('old-cipher');
    });
  });
});
