import { Controller, Get, Param, Body, Post, Delete, Query, Put, ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CustomEventDto } from './dto/custom-event.dto';
import { CustomEventService } from './custom-events.service';
import { CustomEventEntity } from '../../entities/custom-event.entity';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('custom-events')
@ApiBearerAuth()
@ApiTags('Custom Events')
export class CustomEventController {
  constructor(private readonly customEventService: CustomEventService) {}

  @ApiOperation({ summary: 'Get all Custom Events' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('infra:view')
  @Get()
  async findAll(@Query() params) {
    return this.customEventService.listPaginated(params);
  }

  @ApiOperation({ summary: 'Get a Custom Event' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('infra:view')
  @Get('/:id')
  async findOneById(@Param('id') id: number): Promise<CustomEventEntity> {
    return this.customEventService.findOneById(id);
  }

  @ApiOperation({ summary: 'Create a Custom Event' })
  @RequirePermission('infra:manage')
  @Post()
  async create(@Body() customEventDto: CustomEventDto): Promise<CustomEventEntity> {
    return this.customEventService.create(customEventDto);
  }

  @ApiOperation({ summary: 'Update a Custom Event' })
  @RequirePermission('infra:manage')
  @Put('/:id')
  async update(@Param('id') id: number, @Body() customEventDto: CustomEventDto): Promise<CustomEventEntity> {
    return this.customEventService.update(id, customEventDto);
  }

  @ApiOperation({ summary: 'Delete a Custom Event' })
  @RequirePermission('infra:manage')
  @Delete('/:id')
  async delete(@Param('id') id: number) {
    return this.customEventService.delete(id);
  }

  @ApiOperation({ summary: 'Load custom events logs' })
  @RequirePermission('infra:view')
  @Get('/:id/logs')
  async loadLogs(@Param('id') id: number, @Query() params) {
    return this.customEventService.loadLogs(id, params);
  }
}
