import { ClassSerializerInterceptor, Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PostmasterService } from './postmaster.service';
import { PostmasterDto } from './dto/postmaster.dto';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('postmaster')
@ApiBearerAuth()
export class PostmasterController {
  constructor(private readonly postmasterService: PostmasterService) {}

  @ApiOperation({ summary: 'Get postmaster statistics' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('analytics:dashboard_view')
  @Get()
  async getDomainValues(@Query() params: PostmasterDto): Promise<any> {
    return this.postmasterService.getDomainValues(params);
  }
}
