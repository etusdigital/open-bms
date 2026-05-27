import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { ImportContext, ImporterStep } from './importer.interface';
import { MessageEntity } from '../entities/message.entity';
import { CampaignMessageEntity } from '../entities/campaign-message.entity';
import { rawInsertPreservingPk, dbNameMap } from '../raw-insert.util';

// messages is M:N with campaigns via campaigns_messages (composite PK
// campaign_id+message_id). The Enterprise API has NO per-campaign filter:
// `GET /messages?campaignId=X` strips campaignId server-side (stripUnknown),
// so filtering by campaign would return the whole account list and produce a
// cartesian product. Two phases:
//   A) Page /messages once (account-wide), insert messages. Natural key =
//      (account_id, name) — messages has @Unique(accountId,name). Record
//      src.id->newId.
//   B) Rebuild campaigns_messages from the real link source: the
//      `campaignMessage` array embedded in each /campaigns campaign.
@Injectable()
export class MessagesImporter implements ImporterStep {
  readonly name = 'messages';

  async run(ctx: ImportContext): Promise<void> {
    if (ctx.accountId === null) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'no_account_id' });
      return;
    }
    const batchSize = parseInt(process.env.ENTERPRISE_IMPORT_BATCH_SIZE_MESSAGES || '500', 10);

    const msgRepo = ctx.dataSource.getRepository<MessageEntity>(MessageEntity);
    const meta = msgRepo.metadata;
    const columnProps = new Set(meta.columns.map((c) => c.propertyName));
    const pkProp = meta.primaryColumns[0]?.propertyName ?? 'id';

    // Phase A: account messages (single paged pass).
    let page = 1;
    let totalDone = 0;
    while (true) {
      const resp = await ctx.client.listMessages({ page, itemsPerPage: batchSize });
      if (!resp.results || resp.results.length === 0) break;

      // Dedup by name within the page (natural key = account_id+name).
      const byName = new Map<string, any>();
      for (const m of resp.results) {
        const nm = m?.name ?? `msg-${m?.id}`;
        if (!byName.has(nm)) byName.set(nm, { ...m, name: nm });
      }
      const names = [...byName.keys()];

      await ctx.dataSource.transaction(async (em) => {
        const txMsg = em.getRepository<MessageEntity>(MessageEntity);

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

        // Re-read the page (preexisting + inserted) and resolve src->newId by
        // natural key (name).
        const all = await txMsg.find({ where: { accountId: ctx.accountId, name: In(names) } as any });
        for (const e of all as any[]) idByName.set(e.name, e[pkProp]);
        for (const [nm, m] of byName) {
          const newMsgId = idByName.get(nm);
          if (newMsgId === undefined) continue;
          if (ctx.scope === 'account' && m[pkProp] !== undefined && m[pkProp] !== null) {
            await ctx.idMapper.record(ctx.jobId, this.name, m[pkProp], newMsgId);
          }
        }
      });

      totalDone += byName.size;
      await ctx.setCheckpoint(this.name, page, ctx.accountId);
      await ctx.updateProgress(this.name, { total: resp.totalItems, done: totalDone, page });
      if (resp.results.length < batchSize) break;
      page++;
    }

    if (totalDone === 0) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'empty' });
      return;
    }

    // Phase B: campaign<->message link (real M:N). The true relation comes
    // from `campaignMessage` embedded in each /campaigns campaign (not
    // /messages?campaignId, which does not filter). Idempotent: composite PK +
    // orIgnore.
    let cpage = 1;
    while (true) {
      const cresp = await ctx.client.listCampaigns({ page: cpage, itemsPerPage: 500 });
      if (!cresp.results || cresp.results.length === 0) break;

      await ctx.dataSource.transaction(async (em) => {
        const txCm = em.getRepository<CampaignMessageEntity>(CampaignMessageEntity);
        for (const camp of cresp.results as any[]) {
          const newCampaignId = ctx.idMapper.resolve(ctx.jobId, ctx.scope, 'campaigns', camp?.id);
          if (newCampaignId == null) continue;
          const links: any[] = Array.isArray(camp?.campaignMessage) ? camp.campaignMessage : [];
          for (const cm of links) {
            const srcMsgId = cm?.messageId ?? cm?.message?.id;
            const newMsgId = ctx.idMapper.resolve(ctx.jobId, ctx.scope, this.name, srcMsgId);
            if (newMsgId == null) continue;
            await txCm
              .createQueryBuilder()
              .insert()
              .values({
                campaignId: Number(newCampaignId),
                messageId: Number(newMsgId),
                statistics: {},
                winner: false,
                resultDate: new Date(),
              } as any)
              .updateEntity(false)
              .orIgnore()
              .execute();
          }
        }
      });

      if (cresp.results.length < 500) break;
      cpage++;
    }
  }
}
