import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { EmailsTemplatesEntity } from '../entities/emails-templates.entity';

@Injectable()
export class EmailTemplatesImporter extends BaseImporter<EmailsTemplatesEntity> {
  readonly name = 'email-templates';
  protected readonly entity = EmailsTemplatesEntity;
  protected readonly batchSize = 500;
  protected readonly naturalKey = ['name'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<EmailsTemplatesEntity>> {
    return ctx.client.listEmailTemplates({ page, itemsPerPage: this.batchSize });
  }
}
