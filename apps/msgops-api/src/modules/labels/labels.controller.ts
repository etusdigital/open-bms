import { Controller, Body, Get, Param, Query, Post, Put, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabelsService } from './labels.service';
import { LabelsDto, LabelsContentsDto, CreateLabelContentDto, RemoveLabelContentDto } from './labels.dto';
import { LabelsFilterDto, LabelsContentsFilterDto } from './labels-filter.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('labels')
@ApiBearerAuth()
@ApiTags('Labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @ApiOperation({ summary: 'Find all labels with pagination and filters.' })
  @RequirePermission('infra:labels_read')
  @Get()
  async findAll(@Query() params: LabelsFilterDto): Promise<PaginationDto<LabelsDto>> {
    return this.labelsService.findAll(params);
  }

  @ApiOperation({ summary: 'Get all label contents with pagination and filters.' })
  @RequirePermission('infra:labels_read')
  @Get('contents')
  async findAllContents(@Query() params: LabelsContentsFilterDto): Promise<PaginationDto<LabelsContentsDto>> {
    return this.labelsService.findAllContents(params);
  }

  @ApiOperation({ summary: 'Get entities associated with a specific label.' })
  @RequirePermission('infra:labels_read')
  @Get(':id/entities')
  async getEntitiesByLabel(@Param('id', ParseIntPipe) labelId: number, @Query('entityName') entityName?: string): Promise<LabelsContentsDto[]> {
    return this.labelsService.getEntitiesByLabel(labelId, entityName);
  }

  @ApiOperation({ summary: 'Get labels associated with a specific entity.' })
  @RequirePermission('infra:labels_read')
  @Get('entity/:entityName/:entityId')
  async getLabelsByEntity(@Param('entityName') entityName: string, @Param('entityId', ParseIntPipe) entityId: number): Promise<LabelsDto[]> {
    return this.labelsService.getLabelsByEntity(entityName, entityId);
  }

  @ApiOperation({ summary: "Get a single label by it's ID. This returns the entity even if it's deleted." })
  @RequirePermission('infra:labels_read')
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<LabelsDto> {
    return this.labelsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new label.' })
  @RequirePermission('infra:manage')
  @Post()
  async createOne(@Body() labelsDto: LabelsDto): Promise<LabelsDto> {
    return this.labelsService.createOne(labelsDto);
  }

  @ApiOperation({ summary: 'Add entities to a label.' })
  @RequirePermission('infra:labels_read')
  @Post('contents')
  async addLabelContents(@Body() createLabelContentDto: CreateLabelContentDto): Promise<LabelsContentsDto[]> {
    return this.labelsService.addLabelContents(createLabelContentDto);
  }

  @ApiOperation({ summary: 'Update an existing label or create a new one.' })
  @RequirePermission('infra:manage')
  @Put()
  async updateOrCreateOne(@Body() labelsDto: LabelsDto): Promise<LabelsDto> {
    return this.labelsService.update(labelsDto);
  }

  @ApiOperation({ summary: 'Remove entities from a label.' })
  @RequirePermission('infra:labels_read')
  @Delete('contents')
  async removeLabelContents(@Body() removeLabelContentDto: RemoveLabelContentDto): Promise<void> {
    return this.labelsService.removeLabelContents(removeLabelContentDto);
  }

  @ApiOperation({ summary: 'Deletes an existing label.' })
  @RequirePermission('infra:manage')
  @Delete(':id')
  async deleteOne(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.labelsService.deleteOne(id);
  }
}
