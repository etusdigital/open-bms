import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnterpriseIdMappingEntity } from './entities/enterprise-id-mapping.entity';

// Cache em memória + persistência por (jobId, entity, sourceId) → newId.
// Em scope=instance, resolve() retorna o próprio sourceId (identidade) — IDs
// foram preservados via SequenceAdvancer.
@Injectable()
export class IdMapperService {
  private readonly logger = new Logger(IdMapperService.name);
  private cache = new Map<string, string>();

  constructor(
    @InjectRepository(EnterpriseIdMappingEntity)
    private readonly repo: Repository<EnterpriseIdMappingEntity>,
  ) {}

  // Chamado no início do processor pra hidratar cache em scope=account.
  async loadFromDb(jobId: string): Promise<void> {
    this.cache.clear();
    const rows = await this.repo.find({ where: { jobId } });
    for (const r of rows) {
      this.cache.set(this.key(jobId, r.entity, r.sourceId), r.newId);
    }
    this.logger.log(`[id-mapper] loaded ${rows.length} mappings for job=${jobId}`);
  }

  async record(jobId: string, entity: string, sourceId: string | number, newId: string | number): Promise<void> {
    const sId = String(sourceId);
    const nId = String(newId);
    this.cache.set(this.key(jobId, entity, sId), nId);
    // Upsert defensivo (PK composto): retomadas que reprocessam uma página podem
    // re-gravar; ON CONFLICT DO NOTHING preserva o primeiro mapping.
    await this.repo.createQueryBuilder().insert().into(EnterpriseIdMappingEntity).values({ jobId, entity, sourceId: sId, newId: nId }).orIgnore().execute();
  }

  resolve(jobId: string, scope: 'account' | 'instance', entity: string, sourceId: string | number | null | undefined): string | null {
    if (sourceId === null || sourceId === undefined) return null;
    const sId = String(sourceId);
    if (scope === 'instance') return sId; // IDs preservados via setval
    return this.cache.get(this.key(jobId, entity, sId)) ?? null;
  }

  private key(jobId: string, entity: string, sourceId: string): string {
    return `${jobId}::${entity}::${sourceId}`;
  }
}
