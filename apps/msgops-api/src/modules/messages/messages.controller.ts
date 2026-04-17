import { Body, ClassSerializerInterceptor, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseInterceptors } from '@nestjs/common';
import { Headers, HttpException, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../dtos/pagination.dto';
import { MessageDto } from './messages.dto';
import { MessagesService } from './messages.service';
import { IpAddress } from '../../decorators/ip_address.decorator';
import { MessagesPageDto } from './dto/messages-page.dto';
import { ValidLinksService } from '../../utils/utils.service';
import { EmailsLabelsDto } from './messages.dto';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CronRoute } from '../authz/cron-route.decorator';
import { ClsService } from 'nestjs-cls';

@Controller('messages')
@ApiBearerAuth()
@ApiTags('CRUD')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly validLinksService: ValidLinksService,
    private readonly cls: ClsService,
  ) {}

  @ApiOperation({ summary: 'Validate if message name already exists.' })
  @RequirePermission('messages:view')
  @Get('validate-name')
  async validateNames(@Query() params: MessagesPageDto) {
    return this.messagesService.validateNames(params);
  }

  @RequirePermission('messages:view')
  @Get('messages-name')
  @ApiOperation({ summary: 'Get id and name of all messages' })
  async listAllMessageName(): Promise<any> {
    return await this.messagesService.listAllMessageName();
  }

  @RequirePermission('messages:view')
  @Get('messages-all')
  @ApiOperation({ summary: 'Get id and name of all messages' })
  async listAllMessages(): Promise<any> {
    return await this.messagesService.listAllMessages();
  }

  @ApiOperation({ summary: 'Get automation messages filter' })
  @RequirePermission('messages:view')
  @Get('select-message-filter')
  async listAutomationMessagesFilter() {
    return await this.messagesService.getAutomationsMenssage(null);
  }

  @ApiOperation({ summary: 'Get all automation messages' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('messages:view')
  @Get(':id')
  async findOneById(@Param('id') id: number): Promise<MessageDto> {
    return await this.messagesService.findOneById(id);
  }

  @ApiOperation({ summary: 'Get click statistics for a message' })
  @ApiQuery({ name: 'filterId', required: false, type: Number })
  @ApiQuery({ name: 'filterType', required: false, type: String, enum: ['campaign', 'automation'] })
  @RequirePermission('messages:view')
  @Get(':id/click-statistics')
  async getMessageClickStatistics(@Param('id') id: number, @Query() params: { filterId?: number; filterType?: 'campaign' | 'automation' }): Promise<MessageDto> {
    return await this.messagesService.getMessageClickStatistics(id, params.filterId, params.filterType);
  }

  @ApiOperation({ summary: 'Create a new automation message' })
  @RequirePermission('messages:create')
  @Post('/')
  async create(@Body() messageDto: MessageDto, @Headers('User-Agent') userAgent?: string, @IpAddress() ipAddress?: string): Promise<MessageDto> {
    if (await this.messagesService.validUniqueTitle(messageDto.title, 0, messageDto.type)) {
      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: 'Nome duplicado. Tente novamente um nome não cadastrado anteriormente.',
        },
        HttpStatus.CONFLICT,
      );
    }
    const invalidLink = await this.validLinksService.validLinks(messageDto.content);
    if (invalidLink.length) {
      throw new HttpException({ status: HttpStatus.BAD_REQUEST, error: `Link inválido no email: ${invalidLink.join(' | ')}` }, HttpStatus.BAD_REQUEST);
    }
    const currentUser = this.cls.get('userId');
    return await this.messagesService.createMessage(messageDto, currentUser, ipAddress, userAgent);
  }

  @ApiOperation({ summary: 'Update an automation message' })
  @RequirePermission('messages:update')
  @Put(':id')
  async update(@Param('id') id: number, @Body() messageDto: MessageDto, @Headers('User-Agent') userAgent?: string, @IpAddress() ipAddress?: string): Promise<MessageDto> {
    if (await this.messagesService.validUniqueTitle(messageDto.title, Number(id), messageDto.type)) {
      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: 'Nome duplicado. Tente novamente um nome não cadastrado anteriormente.',
        },
        HttpStatus.CONFLICT,
      );
    }
    const invalidLink = await this.validLinksService.validLinks(messageDto.content);
    if (invalidLink.length) {
      throw new HttpException({ status: HttpStatus.BAD_REQUEST, error: `Link inválido no email: ${invalidLink.join(' | ')}` }, HttpStatus.BAD_REQUEST);
    }
    const currentUser = this.cls.get('userId');
    return this.messagesService.updateOneById(Number(id), messageDto, currentUser, ipAddress, userAgent);
  }

  @ApiOperation({ summary: 'Changes part of a message (content, subject, preview and fromMail)' })
  @RequirePermission('messages:update')
  @Patch('/:id')
  async patch(
    @Param('id') id: number,
    @Body()
    messageDto: {
      content?: string;
      subject?: string;
      previewText?: string;
      fromMail?: string;
    },
  ) {
    return await this.messagesService.updatePart(Number(id), messageDto);
  }

  @ApiOperation({ summary: 'Delete an automation message' })
  @RequirePermission('messages:delete')
  @Delete(':id')
  async delete(@Param('id') id: number, @Headers('User-Agent') userAgent?: string, @IpAddress() ipAddress?: string) {
    const currentUser = this.cls.get('userId');
    return await this.messagesService.deleteOneById(Number(id), currentUser, ipAddress, userAgent);
  }

  @ApiOperation({ summary: 'Get automation messages' })
  @RequirePermission('messages:view')
  @Get('/')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'itemsPerPage', required: false })
  @ApiQuery({ name: 'title', required: false })
  @ApiQuery({ name: 'ippool', required: false })
  @ApiQuery({ name: 'automationId', required: false })
  @ApiQuery({ name: 'withTests', required: false })
  async listAll(@Query() params: MessagesPageDto): Promise<PaginationDto<MessageDto> | Array<MessageDto>> {
    if (params.page && params.itemsPerPage) {
      return this.messagesService.listPaginated(params);
    }
    return await this.messagesService.listAll(false);
  }

  @ApiOperation({ summary: 'Create a new automation message copy' })
  @RequirePermission('messages:create')
  @Post(':id/copy')
  async duplicateMessage(@Param('id') id: number): Promise<MessageDto> {
    return await this.messagesService.createCopy(Number(id));
  }

  @RequirePermission('messages:view')
  @Get('key-name/:date')
  @ApiOperation({ summary: 'Get key of all messages' })
  async listAllKeyName(@Param('date') date: Date): Promise<any> {
    return await this.messagesService.listAllKeyName(date);
  }

  @CronRoute()
  @Post('monitor-whatsapp-message/:messageId/:accountId')
  async monitorWhatsappMessage(@Param('messageId') messageId: string, @Param('accountId') accountId: number) {
    return this.messagesService.monitorWhatsappMessage(messageId, Number(accountId));
  }

  @CronRoute()
  @Post('template/webhook')
  @ApiOperation({ summary: 'Webhook to update message status' })
  async webhookTemplate(@Body() body: any): Promise<any> {
    return await this.messagesService.updateStatusMessage(body);
  }

  @RequirePermission('messages:view')
  @Get('template/emails-labels')
  @ApiOperation({ summary: 'Get emails labels' })
  @ApiQuery({ name: 'product', required: true })
  @ApiQuery({ name: 'language', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'itemsPerPage', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getEmailsLabels(@Query() params: EmailsLabelsDto): Promise<PaginationDto<EmailsLabelsDto>> {
    return await this.messagesService.getEmailsLabels(params);
  }

  @RequirePermission('messages:view')
  @Get('template/languages')
  @ApiOperation({ summary: 'Get template messages languages' })
  async getLanguages(): Promise<any> {
    return await this.messagesService.getLanguages();
  }

  @RequirePermission('messages:view')
  @Get('template/countries')
  @ApiOperation({ summary: 'Get template messages countries' })
  async getCountry(@Query() params: { language: string }): Promise<any> {
    return await this.messagesService.getCountries(params);
  }

  @RequirePermission('messages:view')
  @Get('template/products')
  @ApiOperation({ summary: 'Get template messages products' })
  async getProducts(@Query() params: EmailsLabelsDto): Promise<any> {
    return await this.messagesService.getProducts(params);
  }
}
