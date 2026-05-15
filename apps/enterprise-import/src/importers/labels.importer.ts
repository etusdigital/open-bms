import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { LabelsEntity } from '../../../msgops-api/src/entities/labels.entity';

@Injectable()
export class LabelsImporter extends BaseImporter<LabelsEntity> {
  readonly name = 'labels';
  protected readonly entity = LabelsEntity;
  protected readonly batchSize = 500;
  protected readonly naturalKey = ['name'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<LabelsEntity>> {
    return ctx.client.listLabels({ page, itemsPerPage: this.batchSize });
  }
}
