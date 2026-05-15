import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { ImportContext, ImporterStep } from './importer.interface';
import { CampaignEntity } from '../../../msgops-api/src/entities/campaign.entity';
import { MessageEntity } from '../../../msgops-api/src/entities/message.entity';
import { CampaignMessageEntity } from '../../../msgops-api/src/entities/campaign-message.entity';
import { rawInsertPreservingPk, dbNameMap } from '../raw-insert.util';

// F1: `messages` NÃO tem coluna campaign_id — o vínculo é a tabela de junção
// `campaigns_messages` (PK composta campaign_id+message_id, com statistics/
// winner/result_date NOT NULL). Iteramos as campanhas já importadas da conta,
// resolvemos o id de origem (Enterprise) via mapping reverso, buscamos as
// mensagens daquela campanha e inserimos a message (todas as colunas, mesmo
// codebase) + o link. Chave natural da message = (account_id, name).
@Injectable()
export class MessagesImporter implements ImporterStep {
  readonly name = 'messages';

  async run(ctx: ImportContext): Promise<void> {
    if (ctx.accountId === null) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'no_account_id' });
      return;
    }
    const batchSize = parseInt(process.env.ENTERPRISE_IMPORT_BATCH_SIZE_MESSAGES || '500', 10);

    const campRepo = ctx.dataSource.getRepository<CampaignEntity>(CampaignEntity);
    const msgRepo = ctx.dataSource.getRepository<MessageEntity>(MessageEntity);
    const meta = msgRepo.metadata;
    const columnProps = new Set(meta.columns.map((c) => c.propertyName));
    const pkProp = meta.primaryColumns[0]?.propertyName ?? 'id';

    const campaigns = await campRepo.find({ where: { accountId: ctx.accountId } as any, select: ['id'] as any });

    let totalDone = 0;
    for (const camp of campaigns as any[]) {
      const sourceCampaignId = await this.findSourceCampaignId(ctx, camp.id);
      if (!sourceCampaignId) continue;

      let page = 1;
      while (true) {
        const resp = await ctx.client.listMessages({ page, itemsPerPage: batchSize, campaignId: sourceCampaignId });
        if (!resp.results || resp.results.length === 0) break;

        const byName = new Map<string, any>();
        for (const m of resp.results) {
          const nm = m?.name ?? `msg-${m?.id}`;
          if (!byName.has(nm)) byName.set(nm, { ...m, name: nm });
        }
        const names = [...byName.keys()];

        await ctx.dataSource.transaction(async (em) => {
          const txMsg = em.getRepository<MessageEntity>(MessageEntity);
          const txCm = em.getRepository<CampaignMessageEntity>(CampaignMessageEntity);

          const existing = await txMsg.find({ where: { accountId: ctx.accountId, name: In(names) } as any });
          const idByName = new Map<string, any>();
          for (const e of existing as any[]) idByName.set(e.name, e[pkProp]);

          const toInsert: Record<string, any>[] = [];
          for (const [nm, m] of byName) {
            if (idByName.has(nm)) continue;
            const row: Record<string, any> = {};
            for (const key of Object.keys(m)) if (columnProps.has(key)) row[key] = m[key];
            if (ctx.scope === 'account') delete row[pkProp];
            else if (m[pkProp] !== undefined) row[pkProp] = m[pkProp];
            row.accountId = ctx.accountId;
            toInsert.push(row);
          }
          if (toInsert.length > 0) {
            if (ctx.scope === 'instance') {
              await rawInsertPreservingPk(em, 'messages', dbNameMap(txMsg.metadata), toInsert);
            } else {
              await txMsg
                .createQueryBuilder()
                .insert()
                .values(toInsert as any)
                .updateEntity(false)
                .orIgnore()
                .execute();
            }
          }

          const all = await txMsg.find({ where: { accountId: ctx.accountId, name: In(names) } as any });
          for (const e of all as any[]) idByName.set(e.name, e[pkProp]);

          for (const [nm, m] of byName) {
            const newMsgId = idByName.get(nm);
            if (newMsgId === undefined) continue;
            if (ctx.scope === 'account' && m[pkProp] !== undefined && m[pkProp] !== null) {
              await ctx.idMapper.record(ctx.jobId, this.name, m[pkProp], newMsgId);
            }
            // Link campaigns_messages (statistics/winner/result_date NOT NULL —
            // valores neutros; rollups reais vêm pelo importer de statistics).
            await txCm
              .createQueryBuilder()
              .insert()
              .values({
                campaignId: camp.id,
                messageId: newMsgId,
                statistics: {},
                winner: false,
                resultDate: new Date(),
              } as any)
              .updateEntity(false)
              .orIgnore()
              .execute();
          }
        });

        totalDone += byName.size;
        await ctx.setCheckpoint(this.name, page, ctx.accountId);
        await ctx.updateProgress(this.name, { done: totalDone, page });
        if (resp.results.length < batchSize) break;
        page++;
      }
    }
  }

  // Reverse lookup: new_id (camp.id no OSS) → source_id (Enterprise).
  // scope=instance → identidade (ids preservados via SequenceAdvancer).
  private async findSourceCampaignId(ctx: ImportContext, newId: number): Promise<number | null> {
    if (ctx.scope === 'instance') return newId;
    const rows: any[] = await ctx.dataSource.query(`SELECT source_id FROM enterprise_id_mappings WHERE job_id = $1 AND entity = 'campaigns' AND new_id = $2 LIMIT 1`, [
      ctx.jobId,
      String(newId),
    ]);
    const sourceId = rows?.[0]?.source_id;
    return sourceId ? Number(sourceId) : null;
  }
}
