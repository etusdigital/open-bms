import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { AutomationEntity } from '../entities/automation.entity';

// NOTA: `steps`/`triggers`/`flowLayout` são jsonb que podem embutir ids de
// custom-fields/tags/campaigns do Enterprise. Em scope=account esses ids
// embutidos NÃO são remapeados (remap profundo de json arbitrário está fora
// de escopo) — documentado como limitação conhecida no runbook.
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
