import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { CustomFieldsEntity } from '../entities/custom-fields.entity';

@Injectable()
export class CustomFieldsImporter extends BaseImporter<CustomFieldsEntity> {
  readonly name = 'custom-fields';
  protected readonly entity = CustomFieldsEntity;
  protected readonly batchSize = 500;
  protected readonly naturalKey = ['name'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<CustomFieldsEntity>> {
    return ctx.client.listCustomFields({ page, itemsPerPage: this.batchSize });
  }
}
