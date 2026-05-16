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
    const safeBaseUrl = assertSafeEnterpriseBaseUrl(dto.enterpriseBaseUrl); // F9 anti-SSRF

    // Idempotência: `accounts.name` tem UNIQUE column-level no DB (não parcial),
    // então uma 2ª tentativa após o import falhar bateria em 23505 "already
    // exists". Reusa a conta deixada pela tentativa anterior em vez de criar
    // duplicata. INCLUI soft-deleted: quando um job falha antes de qualquer
    // progresso, o worker soft-deleta a conta órfã (cleanupOrphanAccount/F18) —
    // a linha some do findOne normal mas o nome continua ocupado na constraint.
    // Recuperamos (restore) a conta em vez de tentar recriar.
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

      // F13: skipDefaults pula api_key_tracker/account_costs, e o account-settings
      // importer só traz `<provider>_settings` — não a chave de tracking nem uma
      // API key gerenciável. Sem isso a conta importada fica sem pixel de
      // tracking e sem API key. Geramos as essenciais (são por-instância e NÃO
      // transferíveis do Enterprise — hash/segredo diferentes por deploy).
      // Só na criação: numa conta reusada essas já existem (e api_key_tracker
      // tem UNIQUE (account_id, name) → re-insert daria 23505).
      try {
        await this.accountsService.createAccountConfig(account.id, [{ api_key_tracker: createHash('md5').update(`bms-${account.id}-api_key_tracker`).digest('hex') }]);
        await this.accountsService.createManagedApiKey(account.id, { name: 'imported-default' }, userId);
      } catch (e: any) {
        // Não aborta o import por causa disso — só loga; a chave pode ser
        // recriada pela UI de API keys depois.
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

  // Importa para uma conta que JÁ existe (passo 1 do wizard reusado). NÃO
  // cria/procura conta por nome e NÃO provisiona tracker/api-key (o passo 1 já
  // criou esses). O accountId é resolvido server-side a partir do admin do
  // wizard — o cliente nunca informa id. Mesma idempotência de job das outras
  // rotas (pending/running → mesmo job; paused/failed → resume; senão novo).
  async createAccountImportForExistingAccount(
    accountId: number,
    params: { enterpriseBaseUrl: string; enterpriseApiKey: string; enterpriseSourceAccountId?: number | null },
    userId: number,
  ): Promise<{ accountId: number; jobId: string }> {
    const safeBaseUrl = assertSafeEnterpriseBaseUrl(params.enterpriseBaseUrl); // F9 anti-SSRF
    // Defesa: valida que a conta existe (lança 404 se não). O id vem do
    // SetupService já resolvido pelo admin do wizard, mas não confiamos cego.
    await this.accountsService.findOne(accountId);
    this.logger.log(`[enterprise-import] importing into existing account=${accountId} (step1 account reuse)`);
    return this.resolveJobAndEnqueue(accountId, safeBaseUrl, params, userId, true);
  }

  // Resolve/enfileira o job para uma conta-alvo já decidida (criada, reusada
  // por nome, ou a conta do passo 1). Idempotência do job — pega o último job
  // dessa conta:
  //  - pending/running  → import já em andamento; devolve o mesmo jobId (sem
  //    erro, sem duplicar) — frontend só precisa pollar o status.
  //  - paused/failed    → "resume": reaproveita a MESMA linha, atualiza
  //    credenciais/baseUrl, zera erro e re-enfileira.
  //  - completed/nenhum → cria um job novo.
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

    // Nunca logar `enterpriseApiKey` ou `encryptedApiKey`. Apenas metadados.
    this.logger.log(`[enterprise-import] enqueuing job jobId=${saved.id} accountId=${accountId} scope=account reused=${reusedAccount}`);

    await this.queue.add('import', { jobId: saved.id }, JOB_OPTS_ENTERPRISE_IMPORT);

    return { accountId, jobId: saved.id };
  }

  // Reset "começar do zero" do import account-scope, chamado quando o usuário
  // (re)abre o Step 2 do wizard. Ordem importa: PRIMEIRO esvazia a fila BullMQ
  // (para/remove jobs waiting/active/delayed) pra o worker não continuar
  // escrevendo numa conta que vamos apagar; SÓ DEPOIS deleta os dados.
  // Escopo estrito: só a pegada do próprio import (jobs scope=account +
  // id-mappings via cascade + as contas que o import criou + seus filhos via
  // cascade). NÃO toca em outras contas/users/config. `extraAccountIds` cobre
  // o accountId do enterprise_import_done caso o job já não exista.
  async resetForSetup(extraAccountIds: number[] = []): Promise<{ accountsDeleted: number; jobsDeleted: number }> {
    // 1) Para/remove TUDO da fila dedicada (force: remove até jobs active).
    try {
      await this.queue.obliterate({ force: true });
    } catch (e: any) {
      this.logger.warn(`[enterprise-import] queue obliterate falhou (seguindo p/ limpeza de dados): ${e?.message ?? e}`);
    }

    // 2) Apaga os dados em transação.
    return this.jobRepo.manager.transaction(async (em) => {
      const jobRows: Array<{ account_id: number | null }> = await em.query(
        `SELECT DISTINCT account_id FROM enterprise_import_jobs WHERE scope = 'account' AND account_id IS NOT NULL`,
      );
      const ids = Array.from(new Set([...jobRows.map((r) => Number(r.account_id)), ...extraAccountIds].filter((n) => Number.isInteger(n) && n > 0)));

      let accountsDeleted = 0;
      if (ids.length > 0) {
        // labels e automations_targets têm FK p/ accounts SEM onDelete (NO
        // ACTION) → precisam ser apagados ANTES da conta; o resto é CASCADE.
        await em.query(`DELETE FROM automations_targets WHERE account_id = ANY($1)`, [ids]);
        await em.query(`DELETE FROM labels WHERE account_id = ANY($1)`, [ids]);
        // RETURNING: em.query no driver pg devolve as rows, não [rows,count].
        const del: unknown[] = await em.query(`DELETE FROM accounts WHERE id = ANY($1) RETURNING id`, [ids]);
        accountsDeleted = Array.isArray(del) ? del.length : 0;
      }

      // Jobs scope=account não têm FK p/ accounts (account_id é int puro), então
      // apaga aqui; isso cascateia enterprise_id_mappings (job_id FK CASCADE).
      const delJobs: unknown[] = await em.query(`DELETE FROM enterprise_import_jobs WHERE scope = 'account' RETURNING id`);
      const jobsDeleted = Array.isArray(delJobs) ? delJobs.length : 0;

      this.logger.warn(`[enterprise-import] reset-for-setup: contas=${ids.join(',') || '∅'} accountsDeleted=${accountsDeleted} jobsDeleted=${jobsDeleted}`);
      return { accountsDeleted, jobsDeleted };
    });
  }

  async createInstanceImport(enterpriseBaseUrl: string, enterpriseApiKey: string, userId: number | null): Promise<{ jobId: string }> {
    // scope=instance: 1 ativo por vez (não há account_id pra constraint partial).
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
      enterpriseBaseUrl: assertSafeEnterpriseBaseUrl(enterpriseBaseUrl), // F9 (defesa em profundidade)
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

  // F14: o índice parcial único (uniq_running_job_per_account e
  // uniq_running_instance_job) é a defesa real de concorrência. Se a race
  // check-then-insert escapar, o INSERT viola e o Postgres devolve 23505 —
  // traduzimos pra 409 amigável em vez de vazar um 500.
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
