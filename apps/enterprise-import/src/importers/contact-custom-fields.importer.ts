import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { ImportContext, ImporterStep } from './importer.interface';
import { ContactCustomFieldEntity } from '../entities/contact-custom-field.entity';

// Imports the contact<->custom-field VALUES (contacts_custom_fields).
//
// Unlike tags, the relation is NOT embedded in the paginated /contacts payload,
// so it is sourced from the dedicated bulk endpoint /contacts/custom-fields/values
// (msgops-api ContactsController.findCustomFieldValues), which streams the join
// rows directly: { contactId, customFieldId, value, time, number } in SOURCE
// ids. Runs after both `contacts` and `custom-fields` so their src->newId maps
// exist in the idMapper.
//
// Resolution mirrors the tags importer:
//   - scope=account: contact_id/custom_field_id are remapped via idMapper; a
//     row is skipped if either side is unmapped (never an orphan FK).
//   - scope=instance: idMapper.resolve returns the source id unchanged.
//
// Idempotency/resume: the unique constraint on (contact_id, custom_field_id)
// was dropped (migration 1708357825013), so existing (contact, field) pairs are
// pre-filtered in-memory per page. The step owns the `contact_custom_fields`
// checkpoint; reprocessing a page never duplicates. Existing pairs are upserted
// (value/time/number refreshed) so a re-import reflects changed field values.
@Injectable()
export class ContactCustomFieldsImporter implements ImporterStep {
  readonly name = 'contact_custom_fields';
  private readonly logger = new Logger(ContactCustomFieldsImporter.name);
  private readonly batchSize = parseInt(process.env.ENTERPRISE_IMPORT_BATCH_SIZE_CONTACTS || '1000', 10);

  async run(ctx: ImportContext): Promise<void> {
    if (ctx.accountId == null) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'no_account_id' });
      return;
    }

    let page = this.resumePage(ctx);
    let totalLinks = 0;

    while (true) {
      const resp = await ctx.client.listContactCustomFields({ page, itemsPerPage: this.batchSize });
      if (!resp.results || resp.results.length === 0) break;

      // Resolve each join row, dedup within the page on (contactId, customFieldId).
      const rows: Array<{ contactId: number; customFieldId: number; value: string; time: Date | null; number: number | null }> = [];
      const seen = new Set<string>();
      for (const src of resp.results) {
        const newContactId = ctx.idMapper.resolve(ctx.jobId, ctx.scope, 'contacts', src?.contactId);
        if (newContactId === null) continue;
        const newFieldId = ctx.idMapper.resolve(ctx.jobId, ctx.scope, 'custom-fields', src?.customFieldId);
        if (newFieldId === null) continue;
        const key = `${newContactId}:${newFieldId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          contactId: Number(newContactId),
          customFieldId: Number(newFieldId),
          value: src?.value ?? '', // value is NOT NULL in the schema
          time: src?.time ?? null,
          number: src?.number ?? null,
        });
      }

      if (rows.length > 0) {
        await ctx.dataSource.transaction(async (em) => {
          const txRepo = em.getRepository(ContactCustomFieldEntity);
          const contactIds = [...new Set(rows.map((r) => r.contactId))];
          const existing = await txRepo.find({ where: { accountId: ctx.accountId as number, contactId: In(contactIds) } });
          const existingPairs = new Set(existing.map((e) => `${e.contactId}:${e.customFieldId}`));
          const toInsert = rows.filter((r) => !existingPairs.has(`${r.contactId}:${r.customFieldId}`)).map((r) => ({ ...r, accountId: ctx.accountId as number }));
          if (toInsert.length > 0) {
            await txRepo.createQueryBuilder().insert().values(toInsert).updateEntity(false).orIgnore().execute();
          }
          // Upsert: refresh value/time/number for pairs that already exist so a
          // re-import reflects changed field values (not just new links).
          for (const r of rows) {
            if (!existingPairs.has(`${r.contactId}:${r.customFieldId}`)) continue;
            await txRepo.update({ contactId: r.contactId, customFieldId: r.customFieldId, accountId: ctx.accountId as number }, { value: r.value, time: r.time, number: r.number });
          }
        });
      }

      totalLinks += rows.length;
      await ctx.setCheckpoint(this.name, page, ctx.accountId ?? undefined);
      await ctx.updateProgress(this.name, { done: totalLinks, page });

      if (resp.results.length < this.batchSize) break;
      page++;
    }

    if (totalLinks === 0) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'empty' });
    }
  }

  private resumePage(ctx: ImportContext): number {
    if (ctx.checkpoint?.entity === this.name && typeof ctx.checkpoint?.page === 'number') {
      return ctx.checkpoint.page;
    }
    return 1;
  }
}
