import { Controller, Get, Param, Body, Post, Delete, Query, Put, ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { TagDto } from './dto/tags.dto';
import { TagsService } from './tags.service';
import { TagEntity } from '../../entities/tag.entity';
import { TagsPageDto } from './dto/tagsPage.dto';
import { SegmentDto } from './dto/segments.dto';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('tags')
@ApiBearerAuth()
@ApiTags('Tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @ApiOperation({ summary: 'Get all tags' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('audience:tags_view')
  @Get()
  async findAll(@Query() params: TagsPageDto) {
    if (!params.itemsPerPage && !params.page) {
      return this.tagsService.findAll(params);
    }
    if (!params.page) {
      params.page = 1;
    }
    return this.tagsService.listPaginated(params);
  }

  @ApiOperation({ summary: 'Check segment duration.' })
  @RequirePermission('audience:segments_view')
  @Get('/check-segment')
  async checkSegmentDuration() {
    return this.tagsService.checkSegmentDuration();
  }

  @ApiOperation({ summary: 'Validate if tag name already exists.' })
  @RequirePermission('audience:tags_view')
  @Get('/validate-name')
  async validateNames(@Query() params: TagsPageDto) {
    return this.tagsService.validateNames(params);
  }

  @ApiOperation({ summary: 'Get a tag' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('audience:tags_view')
  @Get('/:id')
  async findOneById(@Param('id') id: number): Promise<TagEntity> {
    return this.tagsService.findOneById(id);
  }

  @ApiOperation({ summary: 'Create a tag' })
  @RequirePermission('audience:tags_manage')
  @Post()
  async create(@Body() tagDto: TagDto): Promise<TagEntity> {
    return this.tagsService.create(tagDto);
  }

  @ApiOperation({ summary: 'Update a tag' })
  @RequirePermission('audience:tags_manage')
  @Put('/:id')
  async update(@Param('id') id: number, @Body() tagDto: TagDto): Promise<TagEntity> {
    return this.tagsService.update(id, tagDto);
  }

  @ApiOperation({ summary: 'Delete a tag' })
  @RequirePermission('audience:tags_manage')
  @Delete('/:id')
  async delete(@Param('id') id: number) {
    return this.tagsService.delete(id);
  }

  @ApiOperation({ summary: 'Create a segment' })
  @RequirePermission('audience:segments_execute')
  @Post('segment')
  async createSegment(@Body() segmentDto: SegmentDto) {
    return await this.tagsService.createSegment(segmentDto);
  }

  @ApiOperation({ summary: 'Update a segment' })
  @RequirePermission('audience:segments_execute')
  @Put('segment/:id')
  async updateSegment(@Param('id') id: number, @Body() segmentDto: SegmentDto) {
    return await this.tagsService.updateSegment(id, segmentDto);
  }

  @ApiOperation({ summary: 'Make a copy of a segment' })
  @RequirePermission('audience:segments_execute')
  @Post('segment/:id/copy')
  async createSegmentCopy(@Param('id') id: number): Promise<SegmentDto> {
    return await this.tagsService.createCopy(id);
  }

  @ApiOperation({ summary: 'Run a Segment' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('audience:segments_execute')
  @Get('/segment/run/:id')
  async runSegment(@Param('id') id: number) {
    return this.tagsService.runSegment(id);
  }

  @ApiOperation({ summary: 'Check if a segment is running' })
  @RequirePermission('audience:segments_view')
  @Get('/segment/check/:id')
  async checkSegment(@Param('id') id: number) {
    return this.tagsService.findProcessingSegment(id);
  }

  @ApiOperation({ summary: 'Get base size segment statistics' })
  @RequirePermission('audience:segments_view')
  @Get('/segment/base-size')
  async getBaseSizeStats() {
    return this.tagsService.getBaseSizeStats();
  }
}
