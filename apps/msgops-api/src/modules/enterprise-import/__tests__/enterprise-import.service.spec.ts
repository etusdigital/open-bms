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
  let accountsService: { create: jest.Mock; findByName: jest.Mock; restoreAccount: jest.Mock; createAccountConfig: jest.Mock; createManagedApiKey: jest.Mock };
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
    it('cria conta com skipDefaults:true, persiste job e enfileira', async () => {
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

    it('idempotente: job ativo (running) p/ mesma conta → devolve o mesmo jobId sem duplicar', async () => {
      jobRepo.findOne.mockResolvedValueOnce({ id: 'job-running', status: 'running' });
      const result = await service.createAccountImport({ accountData: { name: 'X' } as any, enterpriseBaseUrl: 'https://x', enterpriseApiKey: 'aaaaaaaa' }, 1);
      expect(result).toEqual({ accountId: 99, jobId: 'job-running' });
      expect(jobRepo.save).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('idempotente: job failed p/ mesma conta → resume (reusa a linha, re-enfileira)', async () => {
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

    it('idempotente: conta já existe (nome) → reusa, não chama accounts.create', async () => {
      accountsService.findByName.mockResolvedValueOnce({ id: 77 });
      jobRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.createAccountImport({ accountData: { name: 'Cliente X' } as any, enterpriseBaseUrl: 'https://x', enterpriseApiKey: 'aaaaaaaa' }, 1);
      expect(accountsService.create).not.toHaveBeenCalled();
      expect(accountsService.createManagedApiKey).not.toHaveBeenCalled();
      expect(result.accountId).toBe(77);
      expect(queue.add).toHaveBeenCalled();
    });

    it('idempotente: conta órfã soft-deletada → restaura e reusa (não recria → sem 23505)', async () => {
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

  describe('resetForSetup', () => {
    it('obliterate na fila ANTES de apagar, deleta filhos não-cascade + conta + jobs', async () => {
      const res = await service.resetForSetup();

      expect(queue.obliterate).toHaveBeenCalledWith({ force: true });
      const sqls = em.query.mock.calls.map((c) => String(c[0]));
      // ordem: collect ids → automations_targets → labels → accounts → jobs
      expect(sqls[0]).toMatch(/SELECT DISTINCT account_id/);
      expect(sqls.some((s) => /DELETE FROM automations_targets/.test(s))).toBe(true);
      expect(sqls.some((s) => /DELETE FROM labels/.test(s))).toBe(true);
      expect(sqls.some((s) => /DELETE FROM accounts WHERE id = ANY/.test(s))).toBe(true);
      expect(sqls.some((s) => /DELETE FROM enterprise_import_jobs WHERE scope = 'account'/.test(s))).toBe(true);
      expect(res).toEqual({ accountsDeleted: 1, jobsDeleted: 1 });
    });

    it('inclui extraAccountIds (accountId do enterprise_import_done) mesmo sem job', async () => {
      em.query.mockImplementation(async (sql: string) => {
        if (/^SELECT DISTINCT account_id/.test(sql)) return []; // nenhum job
        if (/RETURNING id/.test(sql)) return [{ id: 7 }];
        return [];
      });
      const res = await service.resetForSetup([7]);
      const accountsDel = em.query.mock.calls.find((c) => /DELETE FROM accounts WHERE id = ANY/.test(String(c[0])));
      expect(accountsDel?.[1]).toEqual([[7]]);
      expect(res.accountsDeleted).toBe(1);
    });

    it('queue obliterate falhar não aborta a limpeza de dados', async () => {
      queue.obliterate.mockRejectedValueOnce(new Error('redis down'));
      const res = await service.resetForSetup();
      expect(em.query).toHaveBeenCalled();
      expect(res.jobsDeleted).toBe(1);
    });
  });

  describe('getStatus', () => {
    it('retorna ImportStatusDto sem apiKey', async () => {
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

    it('404 quando jobId não existe', async () => {
      jobRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getStatus('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resume', () => {
    it('re-enfileira job em status=failed', async () => {
      const job = { id: 'j1', status: 'failed', encryptedApiKey: 'old-cipher', error: 'boom' };
      jobRepo.findOne.mockResolvedValueOnce(job);
      await service.resume('j1');
      expect(queue.add).toHaveBeenCalled();
      expect(jobRepo.save).toHaveBeenCalled();
    });

    it('rejeita 409 se status=running', async () => {
      jobRepo.findOne.mockResolvedValueOnce({ id: 'j1', status: 'running' });
      await expect(service.resume('j1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('aceita nova apiKey no body e re-cifra', async () => {
      const job = { id: 'j1', status: 'failed', encryptedApiKey: 'old-cipher' };
      jobRepo.findOne.mockResolvedValueOnce(job);
      await service.resume('j1', 'novachave1234');
      // O save deve ter sido chamado com encryptedApiKey alterado
      const savedArg = jobRepo.save.mock.calls[0][0];
      expect(savedArg.encryptedApiKey).toBeTruthy();
      expect(savedArg.encryptedApiKey).not.toBe('old-cipher');
    });
  });
});
