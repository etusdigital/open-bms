import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { ContactEntity } from '../entities/contact.entity';

// Natural key = (account_id, uuid). Do NOT use `email`: it is not unique per
// account in Enterprise (distinct contacts share an email), and the entity has
// no @Unique, so an email-based pre-filter would silently drop rows. `uuid` is
// unique and non-null per source record.
@Injectable()
export class ContactsImporter extends BaseImporter<ContactEntity> {
  readonly name = 'contacts';
  protected readonly entity = ContactEntity;
  protected readonly batchSize = parseInt(process.env.ENTERPRISE_IMPORT_BATCH_SIZE_CONTACTS || '1000', 10);
  protected readonly naturalKey = ['uuid'];
  // Enterprise `/contacts` returns `total: results.length` (page size, not
  // the overall total), so it must not be used as a progress denominator.
  protected readonly reportsTotal = false;

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<ContactEntity>> {
    return ctx.client.listContacts({ page, itemsPerPage: this.batchSize });
  }
}
