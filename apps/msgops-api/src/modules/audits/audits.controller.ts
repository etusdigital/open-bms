import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditDto } from './audits.dto';
import { AuditService } from './audits.service';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('audits')
@ApiBearerAuth()
@ApiTags('CRUD')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @ApiOperation({ summary: 'Get audits automations id' })
  @RequirePermission('audit_logs:view')
  @Get('/:id')
  async findByEntityId(@Param('id') id: number): Promise<Array<AuditDto>> {
    return this.auditService.findByEntityId(id);
  }
}
