import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { CustomEventEntity } from '../entities/custom-event.entity';

@Injectable()
export class CustomEventsImporter extends BaseImporter<CustomEventEntity> {
  readonly name = 'custom-events';
  protected readonly entity = CustomEventEntity;
  protected readonly batchSize = 500;
  protected readonly naturalKey = ['name'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<CustomEventEntity>> {
    return ctx.client.listCustomEvents({ page, itemsPerPage: this.batchSize });
  }
}
