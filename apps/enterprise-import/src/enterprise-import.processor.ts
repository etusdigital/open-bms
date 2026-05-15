import { Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { EnterpriseClient } from './enterprise-client/enterprise.client';
import { IdMapperService } from './id-mapper.service';
import { SequenceAdvancerService } from './sequence-advancer.service';
import { ImportPipeline } from './pipeline';
import { InstanceConfigImporter } from './instance-config.importer';
import { ImportContext } from './importers/importer.interface';
import { EnterpriseApi4xxError } from './enterprise-client/errors';
import { rawInsertPreservingPk, dbNameMap } from './raw-insert.util';

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
    private readonly instanceConfig: InstanceConfigImporter,
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

    entity.status = 'running';
    entity.startedAt = entity.startedAt ?? new Date();
    await this.jobRepo.save(entity);

    try {
      if (entity.scope === 'instance') {
        await this.runInstanceScope(entity, session);
      } else {
        await this.runAccountScope(entity, session);
      }

      entity.status = 'completed';
      entity.finishedAt = new Date();
      entity.encryptedApiKey = null; // descarta segredo
      await this.jobRepo.save(entity);
      this.logger.log(`[enterprise-import] job=${jobId} completed`);
    } catch (err) {
      const isClientError = err instanceof EnterpriseApi4xxError;
      entity.error = (err as Error)?.message?.slice(0, 500) ?? 'unknown';
      if (isClientError) {
        // 4xx: não retry — cancela imediatamente (AC5).
        entity.status = 'failed';
        entity.finishedAt = new Date();
        await this.jobRepo.save(entity);
        await this.cleanupOrphanAccount(entity); // F18
        this.logger.warn(`[enterprise-import] job=${jobId} cancelled (4xx): ${entity.error}`);
        return; // não relança — BullMQ não fará retry
      }
      // 5xx/timeout/erro genérico: relança pra BullMQ aplicar attempts/backoff.
      // Se esgotar attempts, @OnWorkerEvent('failed') marca status='failed'.
      throw err;
    }
  }

  private async runAccountScope(entity: EnterpriseImportJobEntity, session: ReturnType<EnterpriseClient['createSession']>): Promise<void> {
    if (!entity.accountId) throw new Error('account scope requires accountId');
    await this.idMapper.loadFromDb(entity.id);
    const ctx = this.buildCtx(entity, session, entity.accountId, entity.enterpriseSourceAccountId ?? null);
    await this.runPipeline(ctx);
  }

  private async runInstanceScope(entity: EnterpriseImportJobEntity, session: ReturnType<EnterpriseClient['createSession']>): Promise<void> {
    const empty = await this.seq.ensureInstanceTablesEmpty();
    if (!empty.ok) {
      throw new EnterpriseApi4xxError(409, `OSS já tem dados em ${empty.offending} — scope=instance só é seguro em OSS virgem`);
    }
    await this.idMapper.loadFromDb(entity.id);

    // 1) configs globais (idempotente, DO NOTHING — não sobrescreve setup OSS).
    await this.instanceConfig.run(this.buildCtx(entity, session, null, null));

    // 2) iterar contas Enterprise ORDENADAS por id; watermark de retomada (F8):
    // checkpoint.accountId = maior id de conta JÁ TOTALMENTE concluída.
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
        // Pula contas já concluídas em execução anterior (resume — F8). A conta
        // == watermark é reprocessada (pode ter parado no meio do pipeline); os
        // importers são idempotentes por chave natural.
        if (srcId < watermark) continue;

        const accRow: Record<string, any> = {};
        for (const k of Object.keys(sourceAccount)) if (accCols.has(k)) accRow[k] = sourceAccount[k];
        accRow.id = srcId; // instance-scope preserva o id (raw insert — TypeORM
        // QB ignoraria valor explícito em @PrimaryGeneratedColumn)
        await rawInsertPreservingPk(this.dataSource, 'accounts', accDbNames, [accRow]);

        const ctx = this.buildCtx(entity, session, srcId, srcId);
        await this.runPipeline(ctx);

        // Conta concluída → avança watermark (resume pula ela na próxima vez).
        await this.jobRepo.update({ id: entity.id }, { checkpoint: { accountId: srcId } });
      }

      if (resp.results.length < 50) break;
      page++;
    }

    await this.seq.advanceAll();
  }

  private async runPipeline(ctx: ImportContext): Promise<void> {
    const fresh = await this.jobRepo.findOne({ where: { id: ctx.jobId } });
    // Em instance-scope o checkpoint guarda accountId (watermark), não entity.
    const checkpointEntity = ctx.scope === 'account' ? fresh?.checkpoint?.entity : undefined;
    let skipUntil = checkpointEntity ?? null;

    for (const step of this.pipeline.steps) {
      if (skipUntil && step.name !== skipUntil) continue;
      if (skipUntil && step.name === skipUntil) skipUntil = null;
      await step.run(ctx);
    }
  }

  private buildCtx(
    entity: EnterpriseImportJobEntity,
    session: ReturnType<EnterpriseClient['createSession']>,
    accountId: number | null,
    enterpriseSourceAccountId: number | null,
  ): ImportContext {
    return {
      jobId: entity.id,
      accountId,
      enterpriseSourceAccountId,
      scope: entity.scope,
      client: session,
      idMapper: this.idMapper,
      dataSource: this.dataSource,
      checkpoint: entity.checkpoint ?? {},
      // F16: merge atômico via jsonb_set — sem read-modify-write, sem ler o
      // jsonb inteiro a cada página (evita O(n²) em import de 1M+ contatos).
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

  // F18: em scope=account, a conta é criada ANTES do job. Se falhar logo
  // (ex.: API Key inválida → 4xx) sem ter importado nada, a conta fica órfã e
  // vazia. Soft-delete conservador: só se NENHUM progresso foi registrado.
  private async cleanupOrphanAccount(entity: EnterpriseImportJobEntity): Promise<void> {
    if (entity.scope !== 'account' || !entity.accountId) return;
    const progressed = Object.values(entity.progress ?? {}).some((p) => (p?.done ?? 0) > 0);
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
    // F15: só marca terminal quando NÃO há mais tentativas. attemptsMade no
    // evento 'failed' já reflete a tentativa que acabou de falhar.
    if (job.attemptsMade < maxAttempts) return;

    const jobId = job.data?.jobId;
    if (!jobId) return;
    const current = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!current) return;
    // Não clobber estados terminais (4xx já marcou failed; completed não toca).
    if (TERMINAL_STATUSES.includes(current.status)) return;

    current.status = 'failed';
    current.finishedAt = new Date();
    current.error = err?.message?.slice(0, 500) ?? current.error ?? 'unknown';
    await this.jobRepo.save(current);
    await this.cleanupOrphanAccount(current); // F18
  }
}
