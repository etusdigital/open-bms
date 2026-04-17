import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IpReputationService } from './ip-reputation.service';
import { CronRoute } from '../authz/cron-route.decorator';

@Controller('ip-reputation')
@ApiBearerAuth()
@ApiTags('IP Reputation')
export class IpReputationController {
  constructor(private readonly ipReputationService: IpReputationService) {}

  @ApiOperation({ summary: 'Sync IP reputation data from ClickHouse to PostgreSQL (cron - daily)' })
  @CronRoute()
  @Post('/sync')
  async sync() {
    return await this.ipReputationService.syncFromClickhouse();
  }
}
