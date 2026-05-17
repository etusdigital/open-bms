import { Logger } from '@nestjs/common';
import { EntityTarget, In, ObjectLiteral } from 'typeorm';
import { ImportContext, ImporterStep } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { rawInsertPreservingPk } from '../raw-insert.util';

// Base genérica para importadores entidade→entidade.
//
// Premissa-chave (validada): OSS e Enterprise rodam o MESMO codebase, logo a
// API REST do Enterprise serializa cada recurso no mesmo shape da entity
// TypeORM do OSS (propriedades camelCase iguais às `propertyName` das colunas).
// Por isso NÃO escolhemos colunas a dedo (era o bug F1 — colunas inventadas e
// NOT NULL faltando). Em vez disso:
//   1. Inserimos via Repository da entity REAL, copiando apenas as propriedades
//      que correspondem a colunas da entity (metadata-driven) — preserva todos
//      os NOT NULL que o Enterprise já manda preenchidos.
//   2. Resolução src→newId é feita por CHAVE NATURAL relendo as linhas (F3 —
//      antes era posicional sobre `RETURNING` com `ON CONFLICT`, que desalinha).
//   3. FKs escalares são remapeadas via idMapper.resolve em scope=account (F4 —
//      antes `record()` gravava mas nada consumia).
//   4. Idempotência de retomada (F8): a página em curso é pré-filtrada contra o
//      que já existe (por chave natural), então reprocessá-la não duplica mesmo
//      em tabelas sem unique constraint natural.
export abstract class BaseImporter<TEntity extends ObjectLiteral = any> implements ImporterStep {
  protected readonly logger: Logger;
  abstract readonly name: string;
  // Classe da entity TypeORM (do msgops-api) que esse importer popula.
  protected abstract readonly entity: EntityTarget<TEntity>;
  protected abstract readonly batchSize: number;
  // Propriedade(s) que formam a chave natural (além de accountId, se aplicável).
  // Ex.: ['name'] para tags/campaigns; ['email'] para contacts/users.
  protected abstract readonly naturalKey: string[];
  // Se a entity é escopada por conta (coluna accountId): inclui accountId na
  // chave natural e força accountId = ctx.accountId no insert.
  protected readonly scopedByAccount: boolean = true;
  // Mapa FK: propriedade-escalar-da-entity → nome-da-entidade-no-idMapper.
  // Aplicado só em scope=account. Ex.: { campaignId: 'campaigns' }.
  protected readonly fkRemap: Record<string, string> = {};
  // Grava src.id → newId no idMapper (necessário p/ remap de filhos).
  protected readonly recordsIdMapping: boolean = true;
  // Se o endpoint da origem devolve um `totalItems` que é o TOTAL real (e não,
  // p.ex., o tamanho da página). Quando false, o progresso não emite `total`
  // (denominador) — evita barra com done≫total. Ex.: `/contacts` do Enterprise
  // retorna `total: results.length` (tamanho da última página), não o geral.
  protected readonly reportsTotal: boolean = true;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  protected abstract fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<TEntity>>;
  // Override opcional: ajuste fino por linha após o mapeamento genérico.
  // Retornar null pula a linha.
  protected async customize(_ctx: ImportContext, _src: any, mapped: Record<string, any>): Promise<Record<string, any> | null> {
    return mapped;
  }
  // Override opcional: checagem antes do loop; false → pula o importer.
  protected async preflight(_ctx: ImportContext): Promise<boolean> {
    return true;
  }

  async run(ctx: ImportContext): Promise<void> {
    if (this.scopedByAccount && ctx.accountId == null) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'no_account_id' });
      return;
    }
    if (!(await this.preflight(ctx))) return;

    const repo = ctx.dataSource.getRepository<TEntity>(this.entity);
    const meta = repo.metadata;
    const columnProps = new Set(meta.columns.map((c) => c.propertyName));
    const dbNameByProp = new Map(meta.columns.map((c) => [c.propertyName, c.databaseName]));
    const tableName = meta.tableName;
    const pkProp = meta.primaryColumns[0]?.propertyName ?? 'id';
    const nkProp = this.naturalKey[0];

    let page = this.resumePage(ctx);
    let totalDone = 0;
    let totalKnown: number | undefined;

    while (true) {
      const resp = await this.fetchPage(ctx, page);
      if (!resp.results || resp.results.length === 0) break;
      if (resp.totalItems !== undefined) totalKnown = resp.totalItems;

      // Monta linhas candidatas (dedup por chave natural dentro da página).
      const candidates: Array<{ src: any; row: Record<string, any>; nk: string }> = [];
      const seen = new Set<string>();
      for (const src of resp.results) {
        const row = await this.buildRow(ctx, src, columnProps, pkProp);
        if (row === null) continue;
        const nkVal = String(src[nkProp] ?? row[nkProp] ?? '');
        if (!nkVal || seen.has(nkVal)) continue;
        seen.add(nkVal);
        candidates.push({ src, row, nk: nkVal });
      }
      if (candidates.length === 0) {
        if (resp.results.length < this.batchSize) break;
        page++;
        continue;
      }

      const nkValues = candidates.map((c) => c.nk);
      const whereBase: any = this.scopedByAccount ? { accountId: ctx.accountId } : {};
      const mappings: Array<{ sourceId: any; newId: any }> = [];

      await ctx.dataSource.transaction(async (em) => {
        const txRepo = em.getRepository<TEntity>(this.entity);
        // Pré-filtra o que já existe (idempotência de retomada — F8).
        const existing = await txRepo.find({ where: { ...whereBase, [nkProp]: In(nkValues) } as any });
        const existingNk = new Set(existing.map((e: any) => String(e[nkProp])));

        const toInsert = candidates.filter((c) => !existingNk.has(c.nk)).map((c) => c.row);
        if (toInsert.length > 0) {
          if (ctx.scope === 'instance') {
            // Instance-scope PRESERVA o id de origem (ver raw-insert.util).
            await rawInsertPreservingPk(em, tableName, dbNameByProp, toInsert);
          } else {
            // Account-scope: PK omitida → a sequence atribui novo id.
            await txRepo
              .createQueryBuilder()
              .insert()
              .values(toInsert as any)
              .updateEntity(false)
              .orIgnore() // rede de segurança; idempotência real vem do pré-filtro
              .execute();
          }
        }

        // Relê TODAS as linhas da página (pré-existentes + recém-inseridas) e
        // resolve src→newId pela CHAVE NATURAL (não posicional — F3).
        if (this.recordsIdMapping && ctx.scope === 'account') {
          const all = await txRepo.find({ where: { ...whereBase, [nkProp]: In(nkValues) } as any });
          const idByNk = new Map<string, any>();
          for (const e of all as any[]) idByNk.set(String(e[nkProp]), e[pkProp]);
          for (const c of candidates) {
            const newId = idByNk.get(c.nk);
            if (newId !== undefined && c.src?.[pkProp] !== undefined && c.src?.[pkProp] !== null) {
              mappings.push({ sourceId: c.src[pkProp], newId });
            }
          }
        }
      });

      // Grava mappings APÓS o commit (idMapper usa conexão própria — evita
      // cross-connection dentro da transação).
      for (const m of mappings) {
        await ctx.idMapper.record(ctx.jobId, this.name, m.sourceId, m.newId);
      }

      totalDone += candidates.length;
      await ctx.setCheckpoint(this.name, page, ctx.accountId ?? undefined);
      await ctx.updateProgress(this.name, { total: this.reportsTotal ? totalKnown : undefined, done: totalDone, page });

      if (resp.results.length < this.batchSize) break;
      page++;
    }

    // Estado terminal pra UI. Entidades vazias na origem (ou cujo endpoint deu
    // 404 tolerado → resp.results vazio) saem do while no 1º `break` SEM nunca
    // ter chamado updateProgress → ficariam eternamente "pendente" na tela
    // mesmo com o job `completed`. Aqui garantimos que todo step que rodou
    // fecha num estado terminal (100%): `done>0` já foi emitido no loop; se
    // nada foi importado, marca skipped(empty) — exceto resume onde tudo já
    // existia (totalKnown>0), aí conta como concluído.
    if (totalDone === 0) {
      if (this.reportsTotal && totalKnown && totalKnown > 0) {
        await ctx.updateProgress(this.name, { total: totalKnown, done: totalKnown, page });
      } else {
        await ctx.updateProgress(this.name, { skipped: true, reason: 'empty' });
      }
    }
  }

  // Copia do source só as propriedades que são colunas da entity; ajusta PK
  // (descarta em account-scope, preserva em instance-scope) e remapeia FKs.
  private async buildRow(ctx: ImportContext, src: any, columnProps: Set<string>, pkProp: string): Promise<Record<string, any> | null> {
    const row: Record<string, any> = {};
    for (const key of Object.keys(src ?? {})) {
      if (columnProps.has(key)) row[key] = src[key];
    }
    // PK: account-scope deixa a sequence atribuir; instance-scope preserva.
    if (ctx.scope === 'account') {
      delete row[pkProp];
    } else if (src?.[pkProp] !== undefined) {
      row[pkProp] = src[pkProp];
    }
    // accountId sempre o da conta-alvo do contexto.
    if (this.scopedByAccount && columnProps.has('accountId')) {
      row.accountId = ctx.accountId;
    }
    // Remapeia FKs escalares declaradas (só faz sentido em scope=account;
    // em instance os ids são preservados → identidade).
    for (const [prop, mapEntity] of Object.entries(this.fkRemap)) {
      const srcVal = src?.[prop];
      if (srcVal === undefined || srcVal === null) continue;
      const resolved = ctx.idMapper.resolve(ctx.jobId, ctx.scope, mapEntity, srcVal);
      // Em scope=account, se a FK não foi mapeada ainda, melhor pular a linha
      // do que gravar um FK órfão.
      if (ctx.scope === 'account' && resolved === null) return null;
      row[prop] = ctx.scope === 'account' ? Number(resolved) : srcVal;
    }
    return this.customize(ctx, src, row);
  }

  protected resumePage(ctx: ImportContext): number {
    if (ctx.checkpoint?.entity === this.name && typeof ctx.checkpoint?.page === 'number') {
      // Reprocessa a página em curso — seguro: o pré-filtro por chave natural
      // dedup contra o que já foi inserido (F8).
      return ctx.checkpoint.page;
    }
    return 1;
  }
}
