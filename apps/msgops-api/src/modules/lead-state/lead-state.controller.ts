import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LeadStateService } from './lead-state.service';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('automations')
@ApiBearerAuth()
@ApiTags('CRUD')
export class LeadStateController {
  constructor(private readonly leadStateService: LeadStateService) {}

  @ApiOperation({ summary: 'Get all leads per step id' })
  @RequirePermission('automations:view')
  @Get('lead-state')
  @ApiQuery({ name: 'automationTitle', required: true })
  @ApiQuery({ name: 'automationId', required: true })
  @ApiQuery({ name: 'stepId', required: true })
  async listAll(@Query('automationTitle') automationTitle: string, @Query('automationId') automationId: string, @Query('stepId') stepId: string): Promise<number> {
    return await this.leadStateService.getList(automationTitle, automationId, stepId);
  }
}
