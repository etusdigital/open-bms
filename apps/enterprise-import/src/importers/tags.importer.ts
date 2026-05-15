import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { TagEntity } from '../entities/tag.entity';

@Injectable()
export class TagsImporter extends BaseImporter<TagEntity> {
  readonly name = 'tags';
  protected readonly entity = TagEntity;
  protected readonly batchSize = 500;
  protected readonly naturalKey = ['name'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<TagEntity>> {
    return ctx.client.listTags({ page, itemsPerPage: this.batchSize });
  }
}
