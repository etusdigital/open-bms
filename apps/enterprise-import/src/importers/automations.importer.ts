import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { AutomationEntity } from '../entities/automation.entity';

// `steps`/`triggers`/`flowLayout` are jsonb that may embed Enterprise
// custom-field/tag/campaign ids. In scope=account these embedded ids are NOT
// remapped (deep remap of arbitrary json is out of scope) — known limitation.
@Injectable()
export class AutomationsImporter extends BaseImporter<AutomationEntity> {
  readonly name = 'automations';
  protected readonly entity = AutomationEntity;
  protected readonly batchSize = 500;
  protected readonly naturalKey = ['name'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<AutomationEntity>> {
    return ctx.client.listAutomations({ page, itemsPerPage: this.batchSize });
  }
}
