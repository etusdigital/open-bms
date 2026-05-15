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
    const { account } = await this.accountsService.create(dto.accountData, userId, { skipDefaults: true });

    // F13: skipDefaults pula api_key_tracker/account_costs, e o account-settings
    // importer só traz `<provider>_settings` — não a chave de tracking nem uma
    // API key gerenciável. Sem isso a conta importada fica sem pixel de
    // tracking e sem API key. Geramos as essenciais (são por-instância e NÃO
    // transferíveis do Enterprise — hash/segredo diferentes por deploy).
    try {
      await this.accountsService.createAccountConfig(account.id, [{ api_key_tracker: createHash('md5').update(`bms-${account.id}-api_key_tracker`).digest('hex') }]);
      await this.accountsService.createManagedApiKey(account.id, { name: 'imported-default' }, userId);
    } catch (e: any) {
      // Não aborta o import por causa disso — só loga; a chave pode ser
      // recriada pela UI de API keys depois.
      this.logger.warn(`[enterprise-import] could not provision default api key/tracker for account=${account.id}: ${e?.message ?? e}`);
    }

    // Pré-checa concorrência. Existe partial unique no DB (uniq_running_job_per_account)
    // que é a defesa real; aqui é só mensagem amigável antes do conflito 23505.
    const existing = await this.jobRepo.findOne({
      where: { accountId: account.id, status: In(['pending', 'running', 'paused']) },
    });
    if (existing) {
      throw new ConflictException(`Já existe um job de import ativo para a conta ${account.id} (jobId=${existing.id}).`);
    }

    const job = this.jobRepo.create({
      accountId: account.id,
      enterpriseSourceAccountId: dto.enterpriseSourceAccountId ?? null,
      scope: 'account',
      enterpriseBaseUrl: safeBaseUrl,
      encryptedApiKey: encryptApiKey(dto.enterpriseApiKey),
      status: 'pending',
      progress: {},
      checkpoint: {},
      createdBy: userId || null,
    });
    const saved = await this.saveJobWithConcurrencyGuard(job, `conta ${account.id}`);

    // Nunca logar `enterpriseApiKey` ou `encryptedApiKey`. Apenas metadados.
    this.logger.log(`[enterprise-import] enqueuing job jobId=${saved.id} accountId=${account.id} scope=account`);

    await this.queue.add('import', { jobId: saved.id }, JOB_OPTS_ENTERPRISE_IMPORT);

    return { accountId: account.id, jobId: saved.id };
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
