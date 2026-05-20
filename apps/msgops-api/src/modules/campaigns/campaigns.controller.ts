import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClsService } from 'nestjs-cls';
import { PaginationDto } from '../../dtos/pagination.dto';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CampaignDto } from './campaign.dto';
import { CampaignFilterDto } from './campaign-filter.dto';
import { CampaignsType } from './campaigns.interface';
import { CampaignsService } from './campaigns.service';
import { CronRoute } from '../authz/cron-route.decorator';

@Controller('campaigns')
@ApiBearerAuth()
@ApiTags('Campaigns')
export class CampaignsController {
  constructor(
    private readonly campaignService: CampaignsService,
    private readonly cls: ClsService,
  ) {}

  @ApiOperation({ summary: 'Find all campaigns with pagination.' })
  @Get()
  @RequirePermission('campaigns:view')
  async findAll(@Query() params: CampaignFilterDto): Promise<PaginationDto<CampaignDto>> {
    return this.campaignService.findAll(params);
  }

  @ApiOperation({ summary: 'Get send statistics.' })
  @Get('/statistics')
  @RequirePermission('campaigns:view')
  async getStatistics(@Query() campaigns) {
    return await this.campaignService.getStatistics(campaigns);
  }

  @ApiOperation({ summary: 'Get all statistics.' })
  @Get('/statistics-all')
  @RequirePermission('campaigns:view')
  async getAllStatistics(@Query() params: CampaignFilterDto) {
    return await this.campaignService.getAllStatistics(params);
  }

  @ApiOperation({ summary: 'Validate if campaign name already exists.' })
  @Get('/validate-name')
  @RequirePermission('campaigns:view')
  async validateNames(@Query() params: CampaignFilterDto) {
    return this.campaignService.validateNames(params);
  }

  @ApiOperation({ summary: 'Get statistics testab campaigns' })
  @Get('statistics-testab')
  @RequirePermission('campaigns:view')
  async statisticsTestab(@Query() params) {
    return await this.campaignService.statisticsTestab(params);
  }

  @ApiOperation({ summary: 'Late campaigns alert' })
  @Get('late-campaigns')
  @CronRoute()
  async lateCampaigns() {
    return await this.campaignService.lateCampaigns();
  }

  @ApiOperation({ summary: 'Get accounts without minimum number of campaigns in the next 3 days' })
  @Get('accounts-without-campaigns')
  @CronRoute()
  async accountsWithoutCampaigns() {
    return await this.campaignService.accountsWithoutCampaigns();
  }

  @ApiOperation({ summary: "Get a single campaign by it's ID. This returns the entity even if it's deleted." })
  @Get(':id')
  @RequirePermission('campaigns:view')
  async findOne(@Param('id') id: number): Promise<CampaignDto> {
    return await this.campaignService.findOne(Number(id));
  }

  @ApiOperation({ summary: 'Get the count of active contacts.' })
  @Post('/count-contacts')
  @RequirePermission('campaigns:view')
  async countValidContacts(@Body() campaignDto: CampaignDto): Promise<CampaignDto> {
    return await this.campaignService.countValidContacts(campaignDto);
  }

  @ApiOperation({ summary: "Duplicate a campaign by it's ID." })
  @Post('duplicate/:id')
  @RequirePermission('campaigns:duplicate')
  async duplicateCampaign(@Param('id') id: number): Promise<CampaignDto> {
    return await this.campaignService.duplicateCampaign(Number(id));
  }

  @ApiOperation({
    summary: 'Create a new campaign. The id will be assigned at creation and a new campaign with the updated values will be returned as a response.',
  })
  @Post()
  @RequirePermission('campaigns:create')
  async createOne(@Body() campaignDto: CampaignDto): Promise<CampaignDto> {
    const isInternal = this.cls.get('isInternalAccount');
    if (campaignDto.type !== CampaignsType.TRIGGER && isInternal && !campaignDto.name) {
      throw new ForbiddenException('Campaign name is required');
    }
    // Defense in depth: reject campaigns on a channel not enabled for the account.
    // Gating lives here (not in the shared createOne primitive) so the
    // Enterprise→OSS batch import, which reuses createOne, stays un-gated.
    await this.campaignService.assertChannelEnabled(campaignDto.messageType, this.cls.get('accountId'));
    return await this.campaignService.createOne(campaignDto);
  }

  @ApiOperation({
    summary: 'Update an existing campaign or create a new one. The campaign with updated values will be returned as a response.',
  })
  @Put()
  @RequirePermission('campaigns:update')
  async updateOrCreateOne(@Body() campaignDto: CampaignDto): Promise<CampaignDto> {
    const isInternal = this.cls.get('isInternalAccount');
    if (isInternal && !campaignDto.name) {
      throw new ForbiddenException('Campaign name is required');
    }
    return await this.campaignService.update(campaignDto);
  }

  @ApiOperation({
    summary:
      "Deletes an existing campaign. If the campaign does not exist, the response is the same a successful deletion. Objects are not in fact deleted from the database, so they can be restored with a 'Put'",
  })
  @Delete(':id')
  @RequirePermission('campaigns:delete')
  async deleteOne(@Param('id') id: number): Promise<any> {
    return await this.campaignService.deleteOne(Number(id));
  }

  @ApiOperation({ summary: 'Stop running campaigns' })
  @Get('stop/:id')
  @RequirePermission('campaigns:pause')
  async stopCampaign(@Param('id') id: number) {
    return await this.campaignService.stopCampaign(Number(id));
  }
}
