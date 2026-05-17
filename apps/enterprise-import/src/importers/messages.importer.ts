import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { ImportContext, ImporterStep } from './importer.interface';
import { MessageEntity } from '../entities/message.entity';
import { CampaignMessageEntity } from '../entities/campaign-message.entity';
import { rawInsertPreservingPk, dbNameMap } from '../raw-insert.util';

// `messages` é M:N com `campaigns` pela tabela de junção `campaigns_messages`
// (PK composta campaign_id+message_id). NÃO existe filtro por campanha na API
// do Enterprise: `GET /messages?campaignId=X` tem o `campaignId` DESCARTADO
// (MessagesPageDto não declara o campo e o PageDto base usa
// `stripUnknown:true`) → a versão antiga deste importer, que iterava campanha
// a campanha chamando `/messages?campaignId`, recebia a lista da conta INTEIRA
// a cada campanha. Efeitos confirmados em produção: `progress.done` inflado
// (nº de mensagens × nº de campanhas, ex.: 57×53=3021) e `campaigns_messages`
// virando produto cartesiano (toda mensagem ligada a toda campanha).
//
// Abordagem correta, em duas fases:
//   A) Pagina `/messages` UMA vez (account-wide) e insere as mensagens. Chave
//      natural = (account_id, name) — `messages` tem @Unique(accountId,name)
//      e os nomes são únicos por conta. Grava o mapping src.id→newId.
//   B) Reconstrói `campaigns_messages` a partir da fonte real do vínculo: o
//      array `campaignMessage` embutido em cada campanha de `/campaigns`,
//      resolvendo campanha (camp.id) e mensagem (cm.messageId) via idMapper.
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

    // -------- Fase A: mensagens da conta (uma passada paginada) --------
    let page = 1;
    let totalDone = 0;
    while (true) {
      const resp = await ctx.client.listMessages({ page, itemsPerPage: batchSize });
      if (!resp.results || resp.results.length === 0) break;

      // Dedup por nome dentro da página (chave natural = account_id+name).
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

        // Relê tudo da página (pré-existentes + inseridas) e resolve src→newId
        // pela chave natural (name).
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

    // -------- Fase B: vínculo campanha↔mensagem (M:N real) --------
    // A relação verdadeira vem do `campaignMessage` embutido em cada campanha
    // de `/campaigns` (não de `/messages?campaignId`, que não filtra).
    // Idempotente: PK composta (campaign_id, message_id) + orIgnore.
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
