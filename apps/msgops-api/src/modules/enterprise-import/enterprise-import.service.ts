import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EnterpriseImportJobEntity } from '../../entities/enterprise-import-job.entity';
import { JOB_OPTS_ENTERPRISE_IMPORT, QUEUE_ENTERPRISE_IMPORT } from '../../providers/queue/queue.constants';
import { encryptApiKey } from '../../utils/api-key-encryption.util';
import { AccountsService } from '../accounts/accounts.service';
import { ImportAccountDto } from './dtos/import-account.dto';
import { ImportStatusDto } from './dtos/import-status.dto';
import { assertSafeEnterpriseBaseUrl } from './enterprise-import-url.util';

@Injectable()
export class EnterpriseImportService {
  private readonly logger = new Logger(EnterpriseImportService.name);

  constructor(
    @InjectRepository(EnterpriseImportJobEntity)
    private readonly jobRepo: Repository<EnterpriseImportJobEntity>,
    @InjectQueue(QUEUE_ENTERPRISE_IMPORT) private readonly queue: Queue,
    private readonly accountsService: AccountsService,
  ) {}

  async createAccountImport(dto: ImportAccountDto, userId: number): Promise<{ accountId: number; jobId: string }> {
    const safeBaseUrl = assertSafeEnterpriseBaseUrl(dto.enterpriseBaseUrl); // anti-SSRF

    // Idempotency: `accounts.name` has a column-level (non-partial) UNIQUE in
    // the DB, so a 2nd attempt after a failed import would hit 23505 "already
    // exists". Reuse the account left by the previous attempt instead of
    // creating a duplicate. INCLUDES soft-deleted: when a job fails before any
    // progress, the worker soft-deletes the orphan account, so the row vanishes
    // from a normal findOne but the name still occupies the constraint —
    // restore it instead of recreating.
    const accountName = (dto.accountData as any)?.name as string | undefined;
    let account = accountName ? await this.accountsService.findByName(accountName, { withDeleted: true }) : null;
    const reusedAccount = !!account;
    if (account?.deletedAt) {
      this.logger.log(`[enterprise-import] recovering soft-deleted orphan account=${account.id} name="${accountName}" (retry-safe)`);
      await this.accountsService.restoreAccount(account.id);
      account.deletedAt = null as any;
    }
    if (!account) {
      ({ account } = await this.accountsService.create(dto.accountData, userId, { skipDefaults: true }));

      // skipDefaults skips api_key_tracker/account_costs, and the
      // account-settings importer only brings `<provider>_settings` — not the
      // tracking key nor a managed API key. Without these the imported account
      // has no tracking pixel and no API key. Generate the essentials (they are
      // per-instance and NOT transferable from Enterprise — different
      // hash/secret per deploy). Only on creation: on a reused account these
      // already exist (and api_key_tracker has UNIQUE (account_id, name), so a
      // re-insert would 23505).
      try {
        await this.accountsService.createAccountConfig(account.id, [{ api_key_tracker: createHash('md5').update(`bms-${account.id}-api_key_tracker`).digest('hex') }]);
        await this.accountsService.createManagedApiKey(account.id, { name: 'imported-default' }, userId);
      } catch (e: any) {
        // Do not abort the import for this — just log; the key can be recreated
        // later via the API keys UI.
        this.logger.warn(`[enterprise-import] could not provision default api key/tracker for account=${account.id}: ${e?.message ?? e}`);
      }
    } else {
      this.logger.log(`[enterprise-import] reusing existing account=${account.id} name="${accountName}" (retry-safe)`);
    }

    return this.resolveJobAndEnqueue(
      account.id,
      safeBaseUrl,
      { enterpriseApiKey: dto.enterpriseApiKey, enterpriseSourceAccountId: dto.enterpriseSourceAccountId },
      userId,
      reusedAccount,
    );
  }

  // Imports into an account that ALREADY exists (reused wizard step 1). Does
  // NOT create/look-up an account by name and does NOT provision
  // tracker/api-key (step 1 already created those). accountId is resolved
  // server-side from the wizard admin — the client never supplies an id. Same
  // job idempotency as the other routes (pending/running -> same job;
  // paused/failed -> resume; otherwise new).
  async createAccountImportForExistingAccount(
    accountId: number,
    params: { enterpriseBaseUrl: string; enterpriseApiKey: string; enterpriseSourceAccountId?: number | null },
    userId: number,
  ): Promise<{ accountId: number; jobId: string }> {
    const safeBaseUrl = assertSafeEnterpriseBaseUrl(params.enterpriseBaseUrl); // anti-SSRF
    // Validate the account exists (throws 404 if not). The id comes from
    // SetupService already resolved by the wizard admin, but do not trust it
    // blindly.
    await this.accountsService.findOne(accountId);
    this.logger.log(`[enterprise-import] importing into existing account=${accountId} (step1 account reuse)`);
    return this.resolveJobAndEnqueue(accountId, safeBaseUrl, params, userId, true);
  }

  // Resolve/enqueue the job for an already-decided target account (created,
  // reused by name, or the step-1 account). Job idempotency — takes the latest
  // job for that account:
  //  - pending/running  -> import already in progress; return the same jobId
  //    (no error, no duplicate) — frontend just polls the status.
  //  - paused/failed    -> "resume": reuse the SAME row, update
  //    credentials/baseUrl, clear error and re-enqueue.
  //  - completed/none   -> create a new job.
  private async resolveJobAndEnqueue(
    accountId: number,
    safeBaseUrl: string,
    params: { enterpriseApiKey: string; enterpriseSourceAccountId?: number | null },
    userId: number,
    reusedAccount: boolean,
  ): Promise<{ accountId: number; jobId: string }> {
    const lastJob = await this.jobRepo.findOne({
      where: { accountId },
      order: { createdAt: 'DESC' },
    });

    if (lastJob && (lastJob.status === 'pending' || lastJob.status === 'running')) {
      this.logger.log(`[enterprise-import] import já ativo jobId=${lastJob.id} accountId=${accountId} status=${lastJob.status} — idempotente`);
      return { accountId, jobId: lastJob.id };
    }

    if (lastJob && (lastJob.status === 'paused' || lastJob.status === 'failed')) {
      lastJob.enterpriseSourceAccountId = params.enterpriseSourceAccountId ?? lastJob.enterpriseSourceAccountId ?? null;
      lastJob.enterpriseBaseUrl = safeBaseUrl;
      lastJob.encryptedApiKey = encryptApiKey(params.enterpriseApiKey);
      lastJob.status = 'pending';
      lastJob.error = null;
      lastJob.createdBy = lastJob.createdBy ?? userId ?? null;
      const resumed = await this.saveJobWithConcurrencyGuard(lastJob, `conta ${accountId}`);
      this.logger.log(`[enterprise-import] resuming job jobId=${resumed.id} accountId=${accountId} (era status=${lastJob.status})`);
      await this.queue.add('import', { jobId: resumed.id }, JOB_OPTS_ENTERPRISE_IMPORT);
      return { accountId, jobId: resumed.id };
    }

    const job = this.jobRepo.create({
      accountId,
      enterpriseSourceAccountId: params.enterpriseSourceAccountId ?? null,
      scope: 'account',
      enterpriseBaseUrl: safeBaseUrl,
      encryptedApiKey: encryptApiKey(params.enterpriseApiKey),
      status: 'pending',
      progress: {},
      checkpoint: {},
      createdBy: userId || null,
    });
    const saved = await this.saveJobWithConcurrencyGuard(job, `conta ${accountId}`);

    // Never log `enterpriseApiKey` or `encryptedApiKey`. Metadata only.
    this.logger.log(`[enterprise-import] enqueuing job jobId=${saved.id} accountId=${accountId} scope=account reused=${reusedAccount}`);

    await this.queue.add('import', { jobId: saved.id }, JOB_OPTS_ENTERPRISE_IMPORT);

    return { accountId, jobId: saved.id };
  }

  // "Start from scratch" reset of the account-scope import, called when the
  // user (re)opens wizard Step 2. Order matters: FIRST drain the BullMQ queue
  // (stop/remove waiting/active/delayed jobs) so the worker does not keep
  // writing to an account we are about to delete; ONLY THEN delete the data.
  // Strict scope: only this import's own footprint (scope=account jobs +
  // id-mappings via cascade + the accounts the import created + their children
  // via cascade). Does NOT touch other accounts/users/config. `extraAccountIds`
  // covers the enterprise_import_done accountId in case the job no longer
  // exists.
  async resetForSetup(extraAccountIds: number[] = []): Promise<{ accountsDeleted: number; jobsDeleted: number }> {
    // 1) Stop/remove EVERYTHING from the dedicated queue (force: removes even active jobs).
    try {
      await this.queue.obliterate({ force: true });
    } catch (e: any) {
      this.logger.warn(`[enterprise-import] queue obliterate falhou (seguindo p/ limpeza de dados): ${e?.message ?? e}`);
    }

    // 2) Delete the data in a transaction.
    return this.jobRepo.manager.transaction(async (em) => {
      const jobRows: Array<{ account_id: number | null }> = await em.query(
        `SELECT DISTINCT account_id FROM enterprise_import_jobs WHERE scope = 'account' AND account_id IS NOT NULL`,
      );
      const ids = Array.from(new Set([...jobRows.map((r) => Number(r.account_id)), ...extraAccountIds].filter((n) => Number.isInteger(n) && n > 0)));

      let accountsDeleted = 0;
      if (ids.length > 0) {
        // labels and automations_targets have an FK to accounts WITHOUT
        // onDelete (NO ACTION) -> must be deleted BEFORE the account; the rest
        // is CASCADE.
        await em.query(`DELETE FROM automations_targets WHERE account_id = ANY($1)`, [ids]);
        await em.query(`DELETE FROM labels WHERE account_id = ANY($1)`, [ids]);
        // RETURNING: em.query on the pg driver returns the rows, not [rows,count].
        const del: unknown[] = await em.query(`DELETE FROM accounts WHERE id = ANY($1) RETURNING id`, [ids]);
        accountsDeleted = Array.isArray(del) ? del.length : 0;
      }

      // scope=account jobs have no FK to accounts (account_id is a plain int),
      // so delete here; this cascades enterprise_id_mappings (job_id FK CASCADE).
      const delJobs: unknown[] = await em.query(`DELETE FROM enterprise_import_jobs WHERE scope = 'account' RETURNING id`);
      const jobsDeleted = Array.isArray(delJobs) ? delJobs.length : 0;

      this.logger.warn(`[enterprise-import] reset-for-setup: contas=${ids.join(',') || '∅'} accountsDeleted=${accountsDeleted} jobsDeleted=${jobsDeleted}`);
      return { accountsDeleted, jobsDeleted };
    });
  }

  async createInstanceImport(enterpriseBaseUrl: string, enterpriseApiKey: string, userId: number | null): Promise<{ jobId: string }> {
    // scope=instance: one active at a time (no account_id for a partial constraint).
    const existing = await this.jobRepo.findOne({
      where: { scope: 'instance', status: In(['pending', 'running', 'paused']) },
    });
    if (existing) {
      throw new ConflictException(`Já existe um job de import scope=instance ativo (jobId=${existing.id}).`);
    }

    const job = this.jobRepo.create({
      accountId: null,
      enterpriseSourceAccountId: null,
      scope: 'instance',
      enterpriseBaseUrl: assertSafeEnterpriseBaseUrl(enterpriseBaseUrl), // anti-SSRF (defense in depth)
      encryptedApiKey: encryptApiKey(enterpriseApiKey),
      status: 'pending',
      progress: {},
      checkpoint: {},
      createdBy: userId,
    });
    const saved = await this.saveJobWithConcurrencyGuard(job, 'scope=instance');

    this.logger.log(`[enterprise-import] enqueuing job jobId=${saved.id} scope=instance`);

    await this.queue.add('import', { jobId: saved.id }, JOB_OPTS_ENTERPRISE_IMPORT);
    return { jobId: saved.id };
  }

  async getStatus(jobId: string): Promise<ImportStatusDto> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    return this.mapToStatusDto(job);
  }

  async resume(jobId: string, newApiKey?: string): Promise<{ jobId: string; status: string }> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    if (job.status === 'running' || job.status === 'completed') {
      throw new ConflictException(`Job ${jobId} está em status=${job.status}; resume aceita apenas failed/paused.`);
    }
    if (job.status !== 'failed' && job.status !== 'paused') {
      throw new BadRequestException(`Status inválido para resume: ${job.status}`);
    }

    if (newApiKey) {
      job.encryptedApiKey = encryptApiKey(newApiKey);
    } else if (!job.encryptedApiKey) {
      throw new BadRequestException('Job não tem mais a apiKey persistida (foi descartada). Reenvie no body deste resume.');
    }

    job.status = 'pending';
    job.error = null;
    await this.jobRepo.save(job);

    this.logger.log(`[enterprise-import] resume jobId=${jobId}`);
    await this.queue.add('import', { jobId }, JOB_OPTS_ENTERPRISE_IMPORT);
    return { jobId, status: 'pending' };
  }

  // The unique partial index (uniq_running_job_per_account and
  // uniq_running_instance_job) is the real concurrency defense. If the
  // check-then-insert race slips through, the INSERT violates it and Postgres
  // returns 23505 — translate it to a friendly 409 instead of leaking a 500.
  private async saveJobWithConcurrencyGuard(job: EnterpriseImportJobEntity, scopeLabel: string): Promise<EnterpriseImportJobEntity> {
    try {
      return await this.jobRepo.save(job);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException(`Já existe um job de import ativo para ${scopeLabel}.`);
      }
      throw err;
    }
  }

  private mapToStatusDto(job: EnterpriseImportJobEntity): ImportStatusDto {
    return {
      jobId: job.id,
      accountId: job.accountId,
      scope: job.scope,
      status: job.status,
      enterpriseBaseUrl: job.enterpriseBaseUrl,
      progress: job.progress ?? {},
      checkpoint: job.checkpoint ?? {},
      error: job.error,
      createdBy: job.createdBy,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }
}
