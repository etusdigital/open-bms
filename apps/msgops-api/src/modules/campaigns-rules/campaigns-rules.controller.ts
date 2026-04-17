import { Controller, Body, Get, Param, Query, Post, Put, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CampaignsRulesService } from './campaigns-rules.service';
import { CampaignsConfigsDto, CampaignsRulesDto } from './campaigns-rules.dto';
import { CampaignsConfigsFilterDto, CampaignsRulesFilterDto } from './campaigns-rules-filter.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('campaigns-rules')
@ApiBearerAuth()
@ApiTags('Campaigns Rules')
export class CampaignsRulesController {
  constructor(private readonly campaignsRulesService: CampaignsRulesService) {}

  @ApiOperation({ summary: 'Find all campaigns rules with pagination.' })
  @RequirePermission('infra:campaign_rules_read')
  @Get('/rules')
  async findAllRules(@Query() params: CampaignsRulesFilterDto): Promise<PaginationDto<CampaignsRulesDto>> {
    return this.campaignsRulesService.findAllRules(params);
  }

  @ApiOperation({ summary: 'Validate if campaign rule name already exists.' })
  @RequirePermission('infra:campaign_rules_read')
  @Get('/rules/validate-name')
  async validateRulesNames(@Query() params: CampaignsRulesFilterDto) {
    return this.campaignsRulesService.validateRulesNames(params);
  }

  @ApiOperation({ summary: "Find a single campaign rule by it's ID." })
  @RequirePermission('infra:campaign_rules_read')
  @Get('/rules/:id')
  async findOneRule(@Param('id') id: number): Promise<CampaignsRulesDto> {
    return await this.campaignsRulesService.findRuleById(id);
  }

  @ApiOperation({ summary: 'Create a new campaign rule.' })
  @RequirePermission('infra:manage')
  @Post('/rules')
  async saveRule(@Body() campaignsRulesDto: CampaignsRulesDto): Promise<CampaignsRulesDto> {
    return await this.campaignsRulesService.saveRule(campaignsRulesDto);
  }

  @ApiOperation({ summary: 'Update an existing campaign rule.' })
  @RequirePermission('infra:manage')
  @Put('/rules/:id')
  async updateRule(@Param('id') id: number, @Body() campaignsRulesDto: CampaignsRulesDto): Promise<CampaignsRulesDto> {
    return await this.campaignsRulesService.updateRule(id, campaignsRulesDto);
  }

  @ApiOperation({ summary: 'Delete an existing campaign rule.' })
  @RequirePermission('infra:manage')
  @Delete('/rules/:id')
  async deleteRule(@Param('id') id: number): Promise<void> {
    return await this.campaignsRulesService.deleteRule(id);
  }

  @ApiOperation({ summary: 'Find all campaigns configs with pagination.' })
  @RequirePermission('infra:campaign_rules_read')
  @Get('/configs')
  async findAllConfigs(@Query() params: CampaignsConfigsFilterDto): Promise<PaginationDto<CampaignsConfigsDto>> {
    return this.campaignsRulesService.findAllConfigs(params);
  }

  @ApiOperation({ summary: 'Validate if campaign config name already exists.' })
  @RequirePermission('infra:campaign_rules_read')
  @Get('/configs/validate-name')
  async validateConfigsNames(@Query() params: CampaignsConfigsFilterDto) {
    return this.campaignsRulesService.validateConfigsNames(params);
  }

  @ApiOperation({ summary: "Get a single campaign config by it's ID." })
  @RequirePermission('infra:campaign_rules_read')
  @Get('/configs/:id')
  async findOne(@Param('id') id: number): Promise<CampaignsConfigsDto> {
    return await this.campaignsRulesService.findConfigById(id);
  }

  @ApiOperation({ summary: 'Create a new campaign config.' })
  @RequirePermission('infra:manage')
  @Post('/configs')
  async save(@Body() campaignsConfigsDto: CampaignsConfigsDto): Promise<CampaignsConfigsDto> {
    return await this.campaignsRulesService.saveConfig(campaignsConfigsDto);
  }

  @ApiOperation({ summary: 'Update an existing campaign config.' })
  @RequirePermission('infra:manage')
  @Put('/configs/:id')
  async update(@Param('id') id: number, @Body() campaignsConfigsDto: CampaignsConfigsDto): Promise<CampaignsConfigsDto> {
    return await this.campaignsRulesService.updateConfig(id, campaignsConfigsDto);
  }

  @ApiOperation({ summary: 'Deletes an existing campaign config.' })
  @RequirePermission('infra:manage')
  @Delete('/configs/:id')
  async delete(@Param('id') id: number): Promise<void> {
    return await this.campaignsRulesService.deleteConfig(id);
  }

  @ApiOperation({ summary: 'Make a copy of a template' })
  @RequirePermission('infra:manage')
  @Post('configs/:id/copy')
  async createTemplateCopy(@Param('id') id: number): Promise<CampaignsConfigsDto> {
    return await this.campaignsRulesService.createCopy(id);
  }
}
