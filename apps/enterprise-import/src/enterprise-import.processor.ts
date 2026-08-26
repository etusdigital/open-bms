import { Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { EnterpriseClient } from './enterprise-client/enterprise.client';
import { IdMapperService } from './id-mapper.service';
import { SequenceAdvancerService } from './sequence-advancer.service';
import { ImportPipeline } from './pipeline';
import { ImportContext } from './importers/importer.interface';
import { EnterpriseApi4xxError } from './enterprise-client/errors';
import { rawInsertPreservingPk, dbNameMap } from './raw-insert.util';

import { expandSelectedSteps } from './step-dependencies';
import { decryptApiKey } from './utils/api-key-encryption.util';
import { EnterpriseImportJobEntity } from './entities/enterprise-import-job.entity';
import { AccountEntity } from './entities/account.entity';

const QUEUE_NAME = 'enterprise-import';
const TERMINAL_STATUSES = ['completed', 'failed'];

@Processor(QUEUE_NAME)
export class EnterpriseImportProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EnterpriseImportProcessor.name);

  constructor(
    @InjectRepository(EnterpriseImportJobEntity) private readonly jobRepo: Repository<EnterpriseImportJobEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly client: EnterpriseClient,
    private readonly idMapper: IdMapperService,
    private readonly seq: SequenceAdvancerService,
    private readonly pipeline: ImportPipeline,
  ) {
    super();
  }

  onModuleInit(): void {
    this.logger.log(`[enterprise-import] processor ready, queue=${QUEUE_NAME}`);
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    const { jobId } = job.data;
    this.logger.log(`[enterprise-import] starting job=${jobId} (bullJobId=${job.id})`);

    const entity = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!entity) throw new Error(`job ${jobId} not found in DB`);
    if (!entity.encryptedApiKey) throw new Error(`job ${jobId} has no encryptedApiKey`);

    const apiKey = decryptApiKey(entity.encryptedApiKey);
    const session = this.client.createSession(entity.enterpriseBaseUrl, apiKey);

    // Never `jobRepo.save(entity)` here: entity was read with empty
    // progress/checkpoint, while importers update those columns directly in
    // the DB (atomic jsonb_set). A full save would overwrite them back to {}.
    // Use partial updates only.
    const startedAt = entity.startedAt ?? new Date();
    await this.jobRepo.update({ id: jobId }, { status: 'running', startedAt });

    try {
      if (entity.scope === 'instance') {
        await this.runInstanceScope(entity, session);
      } else {
        await this.runAccountScope(entity, session);
      }

      await this.jobRepo.update({ id: jobId }, { status: 'completed', finishedAt: new Date(), encryptedApiKey: null });
      this.logger.log(`[enterprise-import] job=${jobId} completed`);
    } catch (err) {
      const isClientError = err instanceof EnterpriseApi4xxError;
      entity.error = (err as Error)?.message?.slice(0, 500) ?? 'unknown';
      if (isClientError) {
        // 4xx: cancel immediately, no retry. Partial update so DB
        // progress/checkpoint are not clobbered.
        entity.status = 'failed';
        entity.finishedAt = new Date();
        await this.jobRepo.update({ id: jobId }, { status: 'failed', finishedAt: entity.finishedAt, error: entity.error });
        await this.cleanupOrphanAccount(entity);
        this.logger.warn(`[enterprise-import] job=${jobId} cancelled (4xx): ${entity.error}`);
        return; // do not rethrow: no BullMQ retry
      }
      // 5xx/timeout/generic: rethrow so BullMQ applies attempts/backoff.
      // On attempts exhausted, @OnWorkerEvent('failed') marks status='failed'.
      throw err;
    }
  }

  private async runAccountScope(entity: EnterpriseImportJobEntity, session: ReturnType<EnterpriseClient['createSession']>): Promise<void> {
    if (!entity.accountId) throw new Error('account scope requires accountId');
    await this.idMapper.loadFromDb(entity.id);

    const ctx = this.buildCtx(entity, session, entity.accountId);
    await this.runPipeline(ctx);
  }

  private async runInstanceScope(entity: EnterpriseImportJobEntity, session: ReturnType<EnterpriseClient['createSession']>): Promise<void> {
    const empty = await this.seq.ensureInstanceTablesEmpty();
    if (!empty.ok) {
      throw new EnterpriseApi4xxError(409, `OSS já tem dados em ${empty.offending} — scope=instance só é seguro em OSS virgem`);
    }
    await this.idMapper.loadFromDb(entity.id);

    // Iterate Enterprise accounts ordered by id; resume watermark
    // checkpoint.accountId = highest already-completed account id.
    const fresh = await this.jobRepo.findOne({ where: { id: entity.id } });
    const watermark = fresh?.checkpoint?.accountId ?? 0;
    const accRepo = this.dataSource.getRepository(AccountEntity);
    const accCols = new Set(accRepo.metadata.columns.map((c) => c.propertyName));
    const accDbNames = dbNameMap(accRepo.metadata);

    let page = 1;
    while (true) {
      const resp = await session.listAllAccounts({ page, itemsPerPage: 50 });
      if (!resp.results || resp.results.length === 0) break;

      const sorted = [...resp.results].sort((a: any, b: any) => Number(a.id) - Number(b.id));
      for (const sourceAccount of sorted) {
        const srcId = Number(sourceAccount.id);
        // Skip accounts finished in a prior run. The account == watermark is
        // reprocessed (may have stopped mid-pipeline); importers are
        // idempotent by natural key.
        if (srcId < watermark) continue;

        const accRow: Record<string, any> = {};
        for (const k of Object.keys(sourceAccount)) if (accCols.has(k)) accRow[k] = sourceAccount[k];
        accRow.id = srcId; // instance-scope preserves the id; raw insert is
        // required since TypeORM QB ignores explicit @PrimaryGeneratedColumn values
        await rawInsertPreservingPk(this.dataSource, 'accounts', accDbNames, [accRow]);

        const ctx = this.buildCtx(entity, session, srcId);
        await this.runPipeline(ctx);

        // Account done: advance watermark so resume skips it next time.
        await this.jobRepo.update({ id: entity.id }, { checkpoint: { accountId: srcId } });
      }

      if (resp.results.length < 50) break;
      page++;
    }

    await this.seq.advanceAll();
  }

  private async runPipeline(ctx: ImportContext): Promise<void> {
    const fresh = await this.jobRepo.findOne({ where: { id: ctx.jobId } });
    // In instance-scope the checkpoint stores accountId (watermark), not entity.
    const checkpointEntity = ctx.scope === 'account' ? fresh?.checkpoint?.entity : undefined;
    let skipUntil = checkpointEntity ?? null;
    // Selective re-import: run only the chosen steps (already expanded to
    // include required parents). null = run the full pipeline.
    const selected = expandSelectedSteps(fresh?.selectedSteps);

    for (const step of this.pipeline.steps) {
      if (selected && !selected.has(step.name)) continue;
      if (skipUntil && step.name !== skipUntil) continue;
      if (skipUntil && step.name === skipUntil) skipUntil = null;
      await step.run(ctx);
    }
  }

  private buildCtx(entity: EnterpriseImportJobEntity, session: ReturnType<EnterpriseClient['createSession']>, accountId: number | null): ImportContext {
    return {
      jobId: entity.id,
      accountId,
      scope: entity.scope,
      client: session,
      idMapper: this.idMapper,
      dataSource: this.dataSource,
      checkpoint: entity.checkpoint ?? {},
      // Atomic merge via jsonb_set, avoiding read-modify-write of the whole
      // jsonb per page (would be O(n^2) for 1M+ contact imports).
      updateProgress: async (name, patch) => {
        await this.jobRepo.query(
          `UPDATE enterprise_import_jobs
             SET progress = jsonb_set(COALESCE(progress, '{}'::jsonb), $2,
                   COALESCE(progress -> $3, '{}'::jsonb) || $4::jsonb, true),
                 updated_at = now()
           WHERE id = $1`,
          [entity.id, `{${name}}`, name, JSON.stringify(patch)],
        );
      },
      setCheckpoint: async (name, page, accId) => {
        await this.jobRepo.update({ id: entity.id }, { checkpoint: { entity: name, page, accountId: accId } });
      },
    };
  }

  // In scope=account the account is created before the job. If it fails early
  // (e.g. invalid API key) with nothing imported, the account is left orphan
  // and empty. Conservative soft-delete: only if no progress was recorded.
  private async cleanupOrphanAccount(entity: EnterpriseImportJobEntity): Promise<void> {
    if (entity.scope !== 'account' || !entity.accountId) return;
    // Re-read progress from the DB: `entity` may be stale (read with
    // progress={}); trusting it would soft-delete an account that did import
    // data on a late 4xx. Importers write progress directly to the DB.
    const fresh = await this.jobRepo.findOne({ where: { id: entity.id } });
    // all_discarded steps record `seen` but no `done` — every source row was read
    // and rejected (e.g. every candidate lost to a unique conflict), which is
    // real progress on data that existed, not an empty/never-ran step. Treating
    // only `done > 0` as progress would soft-delete an account whose job already
    // consumed source rows.
    const progressed = Object.values(fresh?.progress ?? {}).some((p: any) => (p?.done ?? 0) > 0 || (p?.seen ?? 0) > 0);
    if (progressed) return;
    try {
      await this.dataSource.query(`UPDATE accounts SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [entity.accountId]);
      this.logger.warn(`[enterprise-import] soft-deleted orphan account=${entity.accountId} (job failed before any import)`);
    } catch (e: any) {
      this.logger.warn(`[enterprise-import] orphan cleanup failed for account=${entity.accountId}: ${e?.message ?? e}`);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ jobId: string }>, err: Error): Promise<void> {
    this.logger.warn(`[enterprise-import] bullJob=${job.id} failed: ${err?.message}`);
    const maxAttempts = job.opts?.attempts ?? 1;
    // Only mark terminal when no attempts remain. attemptsMade in the
    // 'failed' event already reflects the attempt that just failed.
    if (job.attemptsMade < maxAttempts) return;

    const jobId = job.data?.jobId;
    if (!jobId) return;
    const current = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!current) return;
    // Do not clobber terminal states (4xx already marked failed; leave completed).
    if (TERMINAL_STATUSES.includes(current.status)) return;

    current.status = 'failed';
    current.finishedAt = new Date();
    current.error = err?.message?.slice(0, 500) ?? current.error ?? 'unknown';
    await this.jobRepo.update({ id: jobId }, { status: 'failed', finishedAt: current.finishedAt, error: current.error });
    await this.cleanupOrphanAccount(current);
  }
}
