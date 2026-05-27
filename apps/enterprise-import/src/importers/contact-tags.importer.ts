import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { ImportContext, ImporterStep } from './importer.interface';
import { ContactTagEntity } from '../entities/contact-tag.entity';

// Imports the contact<->tag relationship (contacts_tags join table).
//
// The relationship is not a standalone Enterprise endpoint: the paginated
// `/contacts` response embeds it per contact as a `tags` object keyed by the
// SOURCE tag id (jsonb_object_agg in contacts.service.findAllPaginated). So we
// re-page `/contacts` here, after both `tags` and `contacts` have run and
// recorded their src->newId mappings in the idMapper.
//
// Resolution:
//   - scope=account: contact_id/tag_id are remapped via idMapper; a pair is
//     skipped if either side is not (yet) mapped, never written as an orphan.
//   - scope=instance: idMapper.resolve returns the source id unchanged (ids are
//     preserved via SequenceAdvancer), so the link points at the same rows.
//
// Idempotency/resume: contacts_tags has no unique constraint, so .orIgnore()
// is a no-op — existing (contact_id, tag_id) pairs are pre-filtered in-memory
// per page (mirroring contacts.service.updateTag). The step owns the
// `contact_tags` checkpoint and reprocessing a page never duplicates.
//
// We deliberately do NOT publish tag add-events: this worker writes raw data
// and bypasses the service layer; emitting add-events would fire add-trigger
// automations for every historical link.
@Injectable()
export class ContactTagsImporter implements ImporterStep {
  readonly name = 'contact_tags';
  private readonly logger = new Logger(ContactTagsImporter.name);
  private readonly batchSize = parseInt(process.env.ENTERPRISE_IMPORT_BATCH_SIZE_CONTACTS || '1000', 10);

  async run(ctx: ImportContext): Promise<void> {
    if (ctx.accountId == null) {
      await ctx.updateProgress(this.name, { skipped: true, reason: 'no_account_id' });
      return;
    }

    let page = this.resumePage(ctx);
    let totalLinks = 0;

    while (true) {
      const resp = await ctx.client.listContacts({ page, itemsPerPage: this.batchSize });
      if (!resp.results || resp.results.length === 0) break;

      // Build candidate links from each contact's embedded `tags` map, dedup
      // within the page on the resolved (contactId, tagId) pair.
      const pairs: Array<{ contactId: number; tagId: number }> = [];
      const seen = new Set<string>();
      for (const src of resp.results) {
        const tagsMap = src?.tags;
        if (!tagsMap || typeof tagsMap !== 'object') continue;
        const newContactId = ctx.idMapper.resolve(ctx.jobId, ctx.scope, 'contacts', src.id);
        if (newContactId === null) continue;
        for (const srcTagId of Object.keys(tagsMap)) {
          const newTagId = ctx.idMapper.resolve(ctx.jobId, ctx.scope, 'tags', srcTagId);
          if (newTagId === null) continue;
          const key = `${newContactId}:${newTagId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          pairs.push({ contactId: Number(newContactId), tagId: Number(newTagId) });
        }
      }

      if (pairs.length > 0) {
        await ctx.dataSource.transaction(async (em) => {
          const txRepo = em.getRepository(ContactTagEntity);
          const contactIds = [...new Set(pairs.map((p) => p.contactId))];
          const existing = await txRepo.find({ where: { accountId: ctx.accountId as number, contactId: In(contactIds) } });
          const existingPairs = new Set(existing.map((e) => `${e.contactId}:${e.tagId}`));
          // is_active omitted: NOT NULL DEFAULT true applies on insert.
          const toInsert = pairs
            .filter((p) => !existingPairs.has(`${p.contactId}:${p.tagId}`))
            .map((p) => ({ contactId: p.contactId, tagId: p.tagId, accountId: ctx.accountId as number }));
          if (toInsert.length > 0) {
            await txRepo.createQueryBuilder().insert().values(toInsert).updateEntity(false).orIgnore().execute();
          }
        });
      }

      totalLinks += pairs.length;
      await ctx.setCheckpoint(this.name, page, ctx.accountId ?? undefined);
      // `/contacts` doesn't report a usable total, and link count is unknown
      // upfront, so report progress without `total`.
      await ctx.updateProgress(this.name, { done: totalLinks, page });

      if (resp.results.length < this.batchSize) break;
      page++;
    }

    // Ensure a terminal UI state even when no links were found.
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
