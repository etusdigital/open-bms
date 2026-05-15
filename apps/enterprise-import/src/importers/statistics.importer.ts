import { Injectable } from '@nestjs/common';
import { ImportContext, ImporterStep } from './importer.interface';
import { EnterpriseApi404Error } from '../enterprise-client/errors';
import { EventStatisticsEntity } from '../../../msgops-api/src/entities/event-statistics.entity';

// Rollups Postgres (events_statistics) em chunks de 30 dias. F5: o endpoint
// /statistics/admin/export do Enterprise exige o accountId DE ORIGEM
// (Enterprise). Em scope=instance é identidade; em scope=account usamos
// ctx.enterpriseSourceAccountId (informado pelo operador). Se não houver,
// PULAMOS com motivo claro — antes era um placeholder que mandava o id errado.
@Injectable()
export class StatisticsImporter implements ImporterStep {
  readonly name = 'statistics';

  async run(ctx: ImportContext): Promise<void> {
    if (ctx.accountId === null) return;

    const sourceAccountId = ctx.scope === 'instance' ? ctx.accountId : ctx.enterpriseSourceAccountId;
    if (!sourceAccountId) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'source_account_unknown' });
      return;
    }

    const repo = ctx.dataSource.getRepository<EventStatisticsEntity>(EventStatisticsEntity);
    const meta = repo.metadata;
    const columnProps = new Set(meta.columns.map((c) => c.propertyName));

    const accountRows: any[] = await ctx.dataSource.query(`SELECT created_at FROM accounts WHERE id = $1`, [ctx.accountId]);
    const createdAt = accountRows?.[0]?.created_at ? new Date(accountRows[0].created_at) : null;
    if (!createdAt) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'account_created_at_unknown' });
      return;
    }

    const chunks = this.makeChunks(createdAt, new Date(), 30);
    const itemsPerPage = 500;
    let totalDone = 0;

    for (const { from, to } of chunks) {
      let page = 1;
      while (true) {
        let resp;
        try {
          resp = await ctx.client.exportStatistics({ accountId: sourceAccountId, from, to, page, itemsPerPage });
        } catch (err) {
          if (err instanceof EnterpriseApi404Error) {
            await ctx.updateProgress(this.name, { skipped: true, reason: 'endpoint_not_found' });
            return;
          }
          throw err;
        }
        if (!resp.results || resp.results.length === 0) break;

        const rows = resp.results.map((s: any) => {
          const row: Record<string, any> = {};
          for (const key of Object.keys(s)) if (columnProps.has(key)) row[key] = s[key];
          row.accountId = ctx.accountId; // rollups ficam sob a conta-alvo do OSS
          return row;
        });

        await ctx.dataSource.transaction(async (em) => {
          await em
            .getRepository<EventStatisticsEntity>(EventStatisticsEntity)
            .createQueryBuilder()
            .insert()
            .values(rows as any)
            .updateEntity(false)
            .orIgnore() // idempotente: ON CONFLICT DO NOTHING (PK/unique composto)
            .execute();
        });

        totalDone += resp.results.length;
        await ctx.setCheckpoint(this.name, page, ctx.accountId);
        await ctx.updateProgress(this.name, { done: totalDone, page });
        if (resp.results.length < itemsPerPage) break;
        page++;
      }
    }
  }

  private makeChunks(from: Date, to: Date, days: number): Array<{ from: string; to: string }> {
    const chunks: Array<{ from: string; to: string }> = [];
    let cursor = new Date(from);
    while (cursor <= to) {
      const next = new Date(cursor);
      next.setDate(next.getDate() + days);
      const chunkTo = next > to ? to : next;
      chunks.push({ from: this.iso(cursor), to: this.iso(chunkTo) });
      cursor = new Date(chunkTo);
      cursor.setDate(cursor.getDate() + 1);
    }
    return chunks;
  }

  private iso(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
