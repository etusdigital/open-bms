import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireSuperAdmin } from '../authz/require-super-admin.decorator';
import { ActivityService } from './activity.service';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { FilterParseError } from './filter-parser';

@Controller('admin/activity')
@ApiBearerAuth()
@ApiTags('Admin / Activity')
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Get('events')
  @RequireSuperAdmin()
  @ApiOperation({ summary: 'Query email event log (super-admin debug feed)' })
  async queryEvents(@Query() dto: ActivityQueryDto) {
    try {
      return await this.service.queryEvents(dto);
    } catch (err) {
      if (err instanceof FilterParseError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}
