import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NewPoolsDto } from './new-pool.dto';
import { PoolPageDto } from './pool-page.dto';
import { PoolsDto } from './pools.dto';
import { PoolsService } from './pools.service';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('pools')
@ApiBearerAuth()
@ApiTags('CRUD')
export class PoolsController {
  constructor(private readonly poolService: PoolsService) {}

  @ApiOperation({ summary: 'Get all pools' })
  @RequirePermission('infra:pools_read')
  @Get()
  async list(@Query() params: PoolPageDto) {
    if (!params.itemsPerPage) {
      return await this.poolService.listAll(params);
    }
    return await this.poolService.listPaginated(params);
  }

  @ApiOperation({ summary: 'Get all ips' })
  @RequirePermission('infra:pools_read')
  @Get('sendgrid/ips')
  async getSendgridAllIps() {
    return this.poolService.getAllIps();
  }

  @ApiOperation({ summary: 'Get pool by ID' })
  @RequirePermission('infra:pools_read')
  @Get('sendgrid')
  async getPoolsSendgrid() {
    return this.poolService.getPoolsSendgrid();
  }

  @ApiOperation({ summary: 'Get sending limits from sendgrid' })
  @RequirePermission('infra:pools_read')
  @Get('/get_sending_limits')
  async getSendingLimits() {
    return this.poolService.getSendingLimits();
  }

  @ApiOperation({ summary: 'Get pool by ID' })
  @RequirePermission('infra:pools_read')
  @Get('ips/sendgrid/:poolName')
  async getIpsSendgrid(@Param('poolName') poolName: string) {
    return this.poolService.getIPsSendgrid(poolName);
  }

  @ApiOperation({ summary: 'Get pool by ID' })
  @RequirePermission('infra:pools_read')
  @Get('/:id')
  async findOneById(@Param('id') id: number): Promise<PoolsDto> {
    return this.poolService.findOneById(id);
  }

  @ApiOperation({ summary: 'Create new pools' })
  @RequirePermission('infra:manage')
  @Post()
  async create(@Body() poolDto: NewPoolsDto): Promise<PoolsDto> {
    const message = await this.poolService.create(poolDto);

    return message;
  }

  @ApiOperation({ summary: 'Edit pool' })
  @RequirePermission('infra:manage')
  @Put('/:id')
  async edit(@Param('id') id: number, @Body() poolDto: PoolsDto): Promise<PoolsDto> {
    if (!id) throw new HttpException("Can't update a pool without id.", HttpStatus.BAD_REQUEST);
    poolDto.id = id;

    return await this.poolService.edit(poolDto);
  }

  @ApiOperation({ summary: 'Delete pool' })
  @RequirePermission('infra:manage')
  @Delete('/:id')
  async delete(@Param('id') id: number): Promise<void> {
    if (!id) throw new HttpException("Can't delete a pool without id.", HttpStatus.BAD_REQUEST);

    await this.poolService.delete(id);
  }
}
