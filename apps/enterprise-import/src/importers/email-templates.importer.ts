import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { EmailsTemplatesEntity } from '../entities/emails-templates.entity';

// `emails_templates` has no @Unique and no `uuid`; the only stable per-record
// field is the Enterprise `id`. With natural key `name` alone, distinct
// same-name templates would silently collapse, so the source id is embedded
// deterministically into `name`. customize rewrites both src.name and the
// mapped row so the key and persisted column stay consistent and idempotent.
@Injectable()
export class EmailTemplatesImporter extends BaseImporter<EmailsTemplatesEntity> {
  readonly name = 'email-templates';
  protected readonly entity = EmailsTemplatesEntity;
  protected readonly batchSize = 500;
  protected readonly naturalKey = ['name'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<EmailsTemplatesEntity>> {
    return ctx.client.listEmailTemplates({ page, itemsPerPage: this.batchSize });
  }

  protected async customize(_ctx: ImportContext, src: any, mapped: Record<string, any>): Promise<Record<string, any> | null> {
    const srcId = src?.id;
    if (srcId === undefined || srcId === null) return mapped; // no id: cannot disambiguate
    const suffix = ` #${srcId}`;
    const base = String(src?.name ?? mapped?.name ?? '');
    // Idempotent: do not re-append if already suffixed.
    const stableName = base.endsWith(suffix) ? base : base.slice(0, 255 - suffix.length) + suffix;
    // Natural key reads src[nkProp]; keep src.name and the column aligned.
    src.name = stableName;
    mapped.name = stableName;
    return mapped;
  }
}
