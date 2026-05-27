import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { CampaignEntity } from '../entities/campaign.entity';

// `campaigns.tags` is json (Enterprise tag ids). In scope=account these
// embedded ids are NOT remapped; tag segmentation may need a manual post-import
// re-sync. Known limitation.
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
