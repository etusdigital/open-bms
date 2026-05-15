import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { ContactEntity } from '../entities/contact.entity';

// Volume alto: batch 1000 (configurável via ENTERPRISE_IMPORT_BATCH_SIZE_CONTACTS).
// Chave natural = (account_id, email). O Enterprise serializa o contato inteiro
// (mesmo codebase) então todas as colunas NOT NULL — uuid, hashed_email, flags,
// jsonb properties etc. — vêm preenchidas e são copiadas via metadata.
@Injectable()
export class ContactsImporter extends BaseImporter<ContactEntity> {
  readonly name = 'contacts';
  protected readonly entity = ContactEntity;
  protected readonly batchSize = parseInt(process.env.ENTERPRISE_IMPORT_BATCH_SIZE_CONTACTS || '1000', 10);
  protected readonly naturalKey = ['email'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<ContactEntity>> {
    return ctx.client.listContacts({ page, itemsPerPage: this.batchSize });
  }
}
