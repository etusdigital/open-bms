import { Body, ClassSerializerInterceptor, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomFieldsEntity } from '../../entities/custom-fields.entity';
import { CustomFieldsService } from './custom-fields.service';
import { CustomFieldsDto } from './dto/custom-fields.dto';
import { CustomFieldsPageDto } from './dto/custom-fields-page.dto';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('custom-fields')
@ApiBearerAuth()
@ApiTags('CustomFields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @ApiOperation({ summary: 'Get all custom fields' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('audience:custom_fields_view')
  @Get()
  async findAll(@Query() params: CustomFieldsPageDto) {
    if (!params.itemsPerPage) {
      return this.customFieldsService.findAll();
    }
    return await this.customFieldsService.listPaginated(params);
  }

  @ApiOperation({ summary: 'Get a custom field' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('audience:custom_fields_view')
  @Get('/:id')
  async findOneById(@Param('id') id: number): Promise<CustomFieldsEntity> {
    return this.customFieldsService.findOneById(id);
  }

  @ApiOperation({ summary: 'Create a custom field' })
  @RequirePermission('audience:custom_fields_manage')
  @Post()
  async create(@Body() customFieldDto: CustomFieldsDto): Promise<CustomFieldsEntity> {
    return this.customFieldsService.create(customFieldDto);
  }

  @ApiOperation({ summary: 'Update a custom field' })
  @RequirePermission('audience:custom_fields_manage')
  @Put('/:id')
  async update(@Param('id') id: number, @Body() customFieldDto: CustomFieldsDto): Promise<CustomFieldsEntity> {
    return this.customFieldsService.update(id, customFieldDto);
  }

  @ApiOperation({ summary: 'Delete a custom field' })
  @RequirePermission('audience:custom_fields_manage')
  @Delete('/:id')
  async delete(@Param('id') id: number) {
    return this.customFieldsService.delete(id);
  }
}
