import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { ContactEntity } from '../entities/contact.entity';

// Volume alto: batch 1000 (configurável via ENTERPRISE_IMPORT_BATCH_SIZE_CONTACTS).
// O Enterprise serializa o contato inteiro (mesmo codebase) então todas as
// colunas NOT NULL — uuid, hashed_email, flags, jsonb properties etc. — vêm
// preenchidas e são copiadas via metadata.
//
// Chave natural = (account_id, uuid). NÃO usar `email`: confirmado contra o
// Enterprise real que `email` NÃO é único por conta (muitos contatos distintos
// — uuid/id/created_at diferentes — compartilham o mesmo email; ~32% das linhas
// duplicavam email numa conta de 32428 contatos). Com chave `email` o
// pré-filtro do BaseImporter colapsava esses contatos e a perda era silenciosa
// (a entity `contacts` nem declara @Unique). O `uuid` é único e não-nulo por
// registro na origem. Importante: o índice único do OSS é
// `(email, hashed_email, account_id)` e o `hashed_email` varia por registro
// (não é hash determinístico só do email) → inserir todos os contatos de
// mesmo email NÃO viola a constraint; a perda vinha exclusivamente da chave
// natural errada deste importer.
@Injectable()
export class ContactsImporter extends BaseImporter<ContactEntity> {
  readonly name = 'contacts';
  protected readonly entity = ContactEntity;
  protected readonly batchSize = parseInt(process.env.ENTERPRISE_IMPORT_BATCH_SIZE_CONTACTS || '1000', 10);
  protected readonly naturalKey = ['uuid'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<ContactEntity>> {
    return ctx.client.listContacts({ page, itemsPerPage: this.batchSize });
  }
}
