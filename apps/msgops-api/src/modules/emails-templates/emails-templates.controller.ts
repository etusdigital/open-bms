import { Body, ClassSerializerInterceptor, Controller, Delete, Get, Param, Post, Put, Query, HttpException, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmailsTemplatesDto } from './emails-templates.dto';
import { EmailsTemplatesService } from './emails-templates.service';
import { NewEmailsTemplatesDto } from './new-emails-templates.dto';
import { EmailTemplatePageDto } from './email-template-page.dto';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('email-template')
@ApiBearerAuth()
@ApiTags('CRUD')
export class EmailsTemplatesController {
  constructor(private readonly emailTemplateService: EmailsTemplatesService) {}

  @ApiOperation({ summary: 'Get all templates' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('messages:view')
  @Get()
  async findAll(@Query() params: EmailTemplatePageDto) {
    if (!params.itemsPerPage) {
      return this.emailTemplateService.findAll();
    }
    return await this.emailTemplateService.listPaginated(params);
  }

  @ApiOperation({ summary: 'Get template by ID' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('messages:view')
  @Get('/:id')
  async findOneById(@Param('id') id: number): Promise<EmailsTemplatesDto> {
    return this.emailTemplateService.findOneById(id);
  }

  @ApiOperation({ summary: 'Create new template' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('messages:create')
  @Post()
  async create(@Body() emailTemplateDto: NewEmailsTemplatesDto): Promise<EmailsTemplatesDto> {
    return await this.emailTemplateService.create(emailTemplateDto);
  }

  @ApiOperation({ summary: 'Edit template' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('messages:update')
  @Put('/:id')
  async edit(@Param('id') id: number, @Body() emailTemplateDto: EmailsTemplatesDto): Promise<EmailsTemplatesDto> {
    if (!id) throw new HttpException("Can't update a template without id.", HttpStatus.BAD_REQUEST);
    emailTemplateDto.id = id;
    return await this.emailTemplateService.edit(emailTemplateDto);
  }

  @ApiOperation({ summary: 'Delete template' })
  @RequirePermission('messages:delete')
  @Delete('/:id')
  async delete(@Param('id') id: number): Promise<void> {
    if (!id) throw new HttpException("Can't delete a template without id.", HttpStatus.BAD_REQUEST);
    await this.emailTemplateService.delete(id);
  }

  @ApiOperation({ summary: 'Make a copy of a template' })
  @RequirePermission('messages:create')
  @Post('/:id/copy')
  async createTemplateCopy(@Param('id') id: number): Promise<EmailsTemplatesDto> {
    return await this.emailTemplateService.createCopy(id);
  }
}
