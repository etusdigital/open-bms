import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WarmupEntity } from 'src/entities/warmup.entity';
import { WarmupsDto } from './warmups.dto';
import { WarmupsService } from './warmups.service';
import { RequireSuperAdmin } from '../authz/require-super-admin.decorator';
import { CronRoute } from '../authz/cron-route.decorator';

@Controller('warmups')
@ApiBearerAuth()
@ApiTags('CRUD')
export class WarmupsController {
  constructor(private readonly warmupsService: WarmupsService) {}

  @ApiOperation({ summary: 'Get all warmups' })
  @RequireSuperAdmin()
  @Get()
  async list(@Query() params) {
    if (!params.itemsPerPage) {
      return this.warmupsService.listAll();
    }

    return this.warmupsService.listPaginated(params);
  }

  @ApiOperation({ summary: 'Get warmup by ID' })
  @RequireSuperAdmin()
  @Get('/:id')
  async findOneById(@Param('id') id: number): Promise<WarmupEntity> {
    return this.warmupsService.findOneById(id);
  }

  @ApiOperation({ summary: 'Create new warmup' })
  @RequireSuperAdmin()
  @Post()
  async create(@Body() warmupsDto: WarmupsDto): Promise<WarmupEntity> {
    return this.warmupsService.create(warmupsDto);
  }

  @ApiOperation({ summary: 'Delete warmup' })
  @RequireSuperAdmin()
  @Delete('/:id')
  async delete(@Param('id') id: number): Promise<void> {
    if (!id) throw new HttpException("Can't delete a warmup without id.", HttpStatus.BAD_REQUEST);

    await this.warmupsService.delete(id);
  }

  @ApiOperation({ summary: 'Process warmups calculations for next day' })
  @CronRoute()
  @Post('/process-target')
  async processTarget() {
    return this.warmupsService.processTarget();
  }
}
