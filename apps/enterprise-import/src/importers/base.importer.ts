import { Logger } from '@nestjs/common';
import { EntityTarget, In, ObjectLiteral } from 'typeorm';
import { ImportContext, ImporterStep } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { rawInsertPreservingPk } from '../raw-insert.util';

// Generic base for entity-to-entity importers.
// Key assumption: OSS and Enterprise run the same codebase, so the Enterprise
// REST API serializes each resource with the same shape as the OSS TypeORM
// entity (camelCase props == column propertyNames). Therefore:
//   1. Insert via the real entity Repository, copying only properties that map
//      to columns (metadata-driven), preserving all NOT NULL columns.
//   2. src->newId is resolved by natural key by re-reading rows (not positional).
//   3. Scalar FKs are remapped via idMapper.resolve in scope=account.
//   4. The in-progress page is pre-filtered against existing rows by natural
//      key, so reprocessing it does not duplicate even without a unique constraint.
export abstract class BaseImporter<TEntity extends ObjectLiteral = any> implements ImporterStep {
  protected readonly logger: Logger;
  abstract readonly name: string;
  // TypeORM entity (from msgops-api) this importer populates.
  protected abstract readonly entity: EntityTarget<TEntity>;
  protected abstract readonly batchSize: number;
  // Property(ies) forming the natural key (besides accountId if applicable).
  protected abstract readonly naturalKey: string[];
  // If the entity is account-scoped: include accountId in the natural key and
  // force accountId = ctx.accountId on insert.
  protected readonly scopedByAccount: boolean = true;
  // FK map: entity scalar property -> idMapper entity name. scope=account only.
  protected readonly fkRemap: Record<string, string> = {};
  // Records src.id -> newId in idMapper (needed to remap child rows).
  protected readonly recordsIdMapping: boolean = true;
  // True only if the source `totalItems` is the real total (not page size).
  // When false, progress omits `total` to avoid done >> total.
  protected readonly reportsTotal: boolean = true;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  protected abstract fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<TEntity>>;
  // Optional override: per-row tweak after generic mapping. Return null to skip the row.
  protected async customize(_ctx: ImportContext, _src: any, mapped: Record<string, any>): Promise<Record<string, any> | null> {
    return mapped;
  }
  // Optional override: pre-loop check; false skips the importer.
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

      // Build candidate rows (dedup by natural key within the page).
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
        // Pre-filter rows that already exist (resume idempotency).
        const existing = await txRepo.find({ where: { ...whereBase, [nkProp]: In(nkValues) } as any });
        const existingNk = new Set(existing.map((e: any) => String(e[nkProp])));

        const toInsert = candidates.filter((c) => !existingNk.has(c.nk)).map((c) => c.row);
        if (toInsert.length > 0) {
          if (ctx.scope === 'instance') {
            // Instance-scope preserves the source id (see raw-insert.util).
            await rawInsertPreservingPk(em, tableName, dbNameByProp, toInsert);
          } else {
            // Account-scope: PK omitted so the sequence assigns a new id.
            await txRepo
              .createQueryBuilder()
              .insert()
              .values(toInsert as any)
              .updateEntity(false)
              .orIgnore() // safety net; real idempotency comes from the pre-filter
              .execute();
          }
        }

        // Re-read all page rows (preexisting + just inserted) and resolve
        // src->newId by natural key (not positional).
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

      // Record mappings after commit: idMapper uses its own connection,
      // avoiding a cross-connection write inside the transaction.
      for (const m of mappings) {
        await ctx.idMapper.record(ctx.jobId, this.name, m.sourceId, m.newId);
      }

      totalDone += candidates.length;
      await ctx.setCheckpoint(this.name, page, ctx.accountId ?? undefined);
      await ctx.updateProgress(this.name, { total: this.reportsTotal ? totalKnown : undefined, done: totalDone, page });

      if (resp.results.length < this.batchSize) break;
      page++;
    }

    // Ensure every step that ran ends in a terminal UI state. An empty source
    // (or tolerated 404) breaks before any updateProgress call, which would
    // leave the step "pending" forever even though the job completed. If
    // nothing was imported, mark skipped(empty); a resume where everything
    // already existed (totalKnown>0) counts as done.
    if (totalDone === 0) {
      if (this.reportsTotal && totalKnown && totalKnown > 0) {
        await ctx.updateProgress(this.name, { total: totalKnown, done: totalKnown, page });
      } else {
        await ctx.updateProgress(this.name, { skipped: true, reason: 'empty' });
      }
    }
  }

  // Copies only source properties that are entity columns; adjusts the PK
  // (drop in account-scope, preserve in instance-scope) and remaps FKs.
  private async buildRow(ctx: ImportContext, src: any, columnProps: Set<string>, pkProp: string): Promise<Record<string, any> | null> {
    const row: Record<string, any> = {};
    for (const key of Object.keys(src ?? {})) {
      if (columnProps.has(key)) row[key] = src[key];
    }
    // PK: account-scope lets the sequence assign; instance-scope preserves it.
    if (ctx.scope === 'account') {
      delete row[pkProp];
    } else if (src?.[pkProp] !== undefined) {
      row[pkProp] = src[pkProp];
    }
    // accountId is always the context's target account.
    if (this.scopedByAccount && columnProps.has('accountId')) {
      row.accountId = ctx.accountId;
    }
    // Remap declared scalar FKs (scope=account only; instance preserves ids).
    for (const [prop, mapEntity] of Object.entries(this.fkRemap)) {
      const srcVal = src?.[prop];
      if (srcVal === undefined || srcVal === null) continue;
      const resolved = ctx.idMapper.resolve(ctx.jobId, ctx.scope, mapEntity, srcVal);
      // In scope=account, skip the row rather than write an orphan FK if the
      // FK is not yet mapped.
      if (ctx.scope === 'account' && resolved === null) return null;
      row[prop] = ctx.scope === 'account' ? Number(resolved) : srcVal;
    }
    return this.customize(ctx, src, row);
  }

  protected resumePage(ctx: ImportContext): number {
    if (ctx.checkpoint?.entity === this.name && typeof ctx.checkpoint?.page === 'number') {
      // Reprocess the in-progress page: safe because the natural-key
      // pre-filter dedups against already-inserted rows.
      return ctx.checkpoint.page;
    }
    return 1;
  }
}
