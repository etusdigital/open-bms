import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { CampaignEntity } from '../../../msgops-api/src/entities/campaign.entity';

// NOTA: `campaigns.tags` é json (array de ids de tag do Enterprise). Em
// scope=account esses ids embutidos NÃO são remapeados aqui (json arbitrário);
// segmentação por tag pode precisar de re-sync manual pós-import. Limitação
// conhecida, documentada no runbook.
@Injectable()
export class CampaignsImporter extends BaseImporter<CampaignEntity> {
  readonly name = 'campaigns';
  protected readonly entity = CampaignEntity;
  protected readonly batchSize = 500;
  protected readonly naturalKey = ['name'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<CampaignEntity>> {
    return ctx.client.listCampaigns({ page, itemsPerPage: this.batchSize });
  }
}
