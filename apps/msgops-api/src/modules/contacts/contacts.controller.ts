import {
  BadRequestException,
  Controller,
  Body,
  Get,
  Post,
  ClassSerializerInterceptor,
  UseInterceptors,
  Query,
  Param,
  Res,
  HttpStatus,
  Headers,
  Put,
  Delete,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { ContactDto } from './contacts.dto';
import { FormatterUtils } from '../../utils/pubSub/formatter.utils';
import { PubSubMessage } from '../../utils/pubSub/interfaces';
import { ContactEntity } from '../../entities/contact.entity';
import { ContactsPageDto } from './dto/contactsPage.dto';
import { BulkDeleteContactsDto } from './dto/bulkDeleteContacts.dto';
import { ContactCustomField } from '../services/services.dto';
import { ContactBatch } from './interfaces';
import { Response } from 'express';
import { SuppressedsPageDto } from './dto/suppressedsPage.dto';
import { IpAddress } from 'src/decorators/ip_address.decorator';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CronRoute } from '../authz/cron-route.decorator';
import { ClsService } from 'nestjs-cls';
import { JoiPipe } from 'nestjs-joi';

// Stateless — built once and reused to validate the create() body explicitly,
// since the global JoiPipe can't resolve a schema for the union @Body() type.
const contactDtoPipe = new JoiPipe(ContactDto);

@Controller('contacts')
@ApiBearerAuth()
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly formatterUtils: FormatterUtils,
    private readonly cls: ClsService,
  ) {}

  @ApiOperation({ summary: 'Get all contacts' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('audience:contacts_view')
  @Get()
  async findAll(
    @Query() params: ContactsPageDto,
    @Headers('Current-User') currentUser?: string,
    @Headers('User-Agent') userAgent?: string,
    @IpAddress() ipAddress?: string,
  ): Promise<any> {
    if (!params.itemsPerPage && !params.countOnly) {
      return this.contactsService.findAll();
    }
    return await this.contactsService.findAllPaginated(params, false, currentUser, userAgent, ipAddress);
  }

  // Two-segment path on purpose: a single-segment `/contacts/<x>` collides with
  // `/contacts/:id` on older deployments (500 instead of 404), which would make
  // the import worker fail the whole job instead of gracefully skipping when the
  // endpoint is absent. See EnterpriseSession.listContactCustomFields.
  @ApiOperation({ summary: 'Paginated contact custom-field values (bulk feed for Enterprise import)' })
  @RequirePermission('audience:contacts_view')
  @Get('/custom-fields/values')
  async findCustomFieldValues(@Query() params: ContactsPageDto): Promise<any> {
    return this.contactsService.findCustomFieldValuesPaginated(params);
  }

  @ApiOperation({ summary: 'Get all suppressed contacts' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('audience:contacts_view')
  @Get('/suppressed')
  async findAllSuppressed(@Query() params: SuppressedsPageDto): Promise<any> {
    if (!params.itemsPerPage && !params.countOnly) {
      return this.contactsService.findAllSuppressed();
    }
    return await this.contactsService.findAllSuppressedPaginated(params);
  }

  @ApiOperation({ summary: 'Get total of contacts' })
  @RequirePermission('audience:contacts_view')
  @Get('/count')
  async getTotal(): Promise<number> {
    return this.contactsService.count();
  }

  @ApiOperation({ summary: 'Get dashboard of contacts' })
  @RequirePermission('audience:contacts_view')
  @Get('/dashboard')
  async dashboard(): Promise<any> {
    return this.contactsService.dashboard();
  }

  @RequirePermission('audience:contacts_export')
  @Get('/export')
  async exportContacts(@Query() params: ContactsPageDto, @Res() response: Response, @Headers('User-Agent') userAgent?: string, @IpAddress() ipAddress?: string) {
    const currentUser = this.cls.get('userId');
    const csv = await this.contactsService.findAllPaginated(params, true, currentUser, userAgent, ipAddress);
    response.setHeader('Content-disposition', 'attachment; filename=data.csv');
    response.set('Content-Type', 'text/csv');
    response.status(HttpStatus.CREATED).send(csv);
  }

  @ApiOperation({
    summary: 'Initiate export of contacts',
    description: `Initiates the export of contacts.
    Returns an export ID and estimated total number of contacts to be exported.
    Pass the export ID with /export-stream to stream the export.
    Use the returned export ID with /export-status/:exportId to track progress.`,
  })
  @RequirePermission('audience:contacts_export')
  @Get('/export-init')
  async exportInit(@Query() params: ContactsPageDto, @Headers('User-Agent') userAgent?: string, @IpAddress() ipAddress?: string) {
    const currentUser = this.cls.get('userId');
    return this.contactsService.exportInit(params, currentUser, userAgent, ipAddress);
  }

  @ApiOperation({
    summary: 'Stream export contacts with progress tracking',
    description: `Exports contacts as CSV stream with real-time progress tracking.
    Returns CSV file in a stream format.
    Use the returned in export-init to track progress.`,
  })
  @RequirePermission('audience:contacts_export')
  @Get('/export-stream')
  async exportContactsStream(@Query() params: ContactsPageDto, @Res() response: Response) {
    return this.contactsService.exportContactsStream(params, response);
  }

  @ApiOperation({
    summary: 'Get export status by ID',
    description: `Get the progress status of an export operation.
    Status values: 'starting', 'processing', 'completed', 'error'
    Response includes: status, progress (0-100), total, processedCount, startTime, completedTime, error`,
  })
  @RequirePermission('audience:contacts_export')
  @Get('/export-status/:exportId')
  async getExportStatus(@Param('exportId') exportId: string) {
    return this.contactsService.getExportStatus(exportId);
  }

  @RequirePermission('audience:contacts_suppress')
  @Get('/count-unsubscribe')
  countUnsubscribe(@Query() params: ContactsPageDto) {
    return this.contactsService.countUnsubscribe(params);
  }

  @CronRoute()
  @Post('/clean-push-devices')
  async cleanPushDevices() {
    return this.contactsService.cleanPushDevices();
  }

  @CronRoute()
  @Post('/remove-push-devices')
  async removeInvalidContactsDevices() {
    return this.contactsService.removeInvalidContactsDevices();
  }

  // `:id` accepts a numeric id OR a uuid; findOneByIdentifier detects which.
  // Calling findOneById directly treated a uuid as an integer id -> Postgres
  // "invalid input syntax for type integer" -> 500 when the frontend opened a
  // contact by uuid (e.g. imported contacts).
  @ApiOperation({ summary: 'Get a contact by ID or UUID' })
  @UseInterceptors(ClassSerializerInterceptor)
  @RequirePermission('audience:contacts_view')
  @Get('/:id')
  async findOneById(@Param('id') id: string): Promise<ContactEntity> {
    return this.contactsService.findOneByIdentifier(String(id));
  }

  @ApiOperation({ summary: 'Get a contact history' })
  @RequirePermission('audience:contacts_view')
  @Get('/history/:id')
  async getContactHistory(@Param('id') id: number, @Query() params: ContactsPageDto): Promise<any> {
    return this.contactsService.findContactHistory(id, params);
  }

  @ApiOperation({ summary: 'Update an existing contact' })
  @RequirePermission('audience:contacts_edit')
  @Put('/:id')
  async updateContact(@Param('id') id: string, @Body() data: ContactDto): Promise<ContactDto> {
    if (!this.cls.get('accountId')) {
      throw new BadRequestException('Account context is required. Send the Account-Id header.');
    }
    // Frontend may pass either numeric id or uuid for the same param.
    const isNumeric = /^\d+$/.test(id);
    const contact = await this.contactsService.findByProperty(isNumeric ? { id: Number(id) } : { uuid: id });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return this.contactsService.update(data, contact);
  }

  @ApiOperation({ summary: 'Create or edit a new contact' })
  @RequirePermission('audience:contacts_view')
  @Post('/')
  async create(@Body() data: ContactDto | PubSubMessage | { contact: ContactDto; tagName?: string; tagNames?: string[] }): Promise<ContactDto> {
    const unwrapped = 'subscription' in (data as PubSubMessage) ? this.formatterUtils.parseBatch(data as PubSubMessage) : data;

    // The endpoint accepts two body shapes:
    //   (a) flat ContactDto    — { email, ..., tagNames?: [...] }
    //   (b) wrapped envelope   — { contact: {...}, tagName?: "x" }
    // Pet's external integrations use (b) with a singular `tagName`; the
    // frontend already calls (a). Merge any envelope-level tag fields into
    // the inner contact so a single DTO schema covers both.
    const rawDto: ContactDto =
      unwrapped && typeof unwrapped === 'object' && 'contact' in unwrapped && unwrapped.contact && typeof unwrapped.contact === 'object'
        ? ({
            ...((unwrapped as any).contact ?? {}),
            tagName: (unwrapped as any).tagName ?? (unwrapped as any).contact?.tagName,
            tagNames: (unwrapped as any).tagNames ?? (unwrapped as any).contact?.tagNames,
          } as ContactDto)
        : (unwrapped as ContactDto);

    // @Body() is a union type, so the global JoiPipe can't resolve a single
    // schema and skips validation — a malformed payload would otherwise reach
    // the service raw and surface as a 500. Validate explicitly: type errors
    // -> 400, unknown keys are stripped via @JoiSchemaOptions({ stripUnknown })
    // on ContactDto, leaving an emailless object that the create-path guard
    // below rejects with 400.
    const contactDto = contactDtoPipe.transform(rawDto, { type: 'body' }) as ContactDto;

    const contact = contactDto.email ? await this.contactsService.findByProperty({ email: contactDto.email }) : null;
    if (contact) {
      return await this.contactsService.update(contactDto, contact);
    }
    if (!contactDto.email) {
      throw new BadRequestException('email is required to create a contact');
    }
    return await this.contactsService.create(contactDto);
  }

  @RequirePermission('audience:contacts_view')
  @Post('/custom-fields')
  processContactsCustomFields(@Body() data: ContactCustomField | PubSubMessage) {
    const contactsCustomFields = 'subscription' in (data as PubSubMessage) ? this.formatterUtils.parseBatch(data as PubSubMessage) : (data as ContactCustomField);
    return this.contactsService.processContactsCustomFields(contactsCustomFields);
  }

  @RequirePermission('audience:contacts_import')
  @Post('/import')
  importContacts(@Body() data: ContactBatch) {
    return this.contactsService.importContacts(data);
  }

  @RequirePermission('audience:contacts_view')
  @Post('/tags')
  updateTag(@Body() params: any) {
    return this.contactsService.updateTag(params);
  }

  @RequirePermission('audience:contacts_suppress')
  @Post('/bulk-unsubscribe')
  bulkUnsubscribe(@Body() params: { emails: string[]; date: string; allAccounts?: boolean; block?: boolean }) {
    return this.contactsService.bulkUnsubscribe(params);
  }

  @RequirePermission('audience:contacts_suppress')
  @Post('/bulk-resubscribe')
  bulkResubscribe(@Body() params: { emails: string[]; block?: boolean }) {
    return this.contactsService.bulkResubscribe(params);
  }

  @RequirePermission('audience:contacts_suppress')
  @Post('/unsubscribe')
  async unsubscribe(@Body() params: ContactsPageDto, @Res() response: Response) {
    const result = await this.contactsService.unsubscribe(params);
    response.status(HttpStatus.OK).json({
      message: 'Contacts unsubscribed successfully',
      total: result,
    });
  }

  @ApiOperation({ summary: 'Deactivate inactive contacts', description: 'Called via Google Cloud Tasks every night' })
  @CronRoute()
  @Post('/deactivate-inactive-contacts')
  async deactivateInactiveContacts() {
    return this.contactsService.deactivateInactiveContacts();
  }

  @RequirePermission('audience:contacts_edit')
  @Put('/custom-fields/edit')
  updateContactCustomFieldValue(@Body() params: any) {
    return this.contactsService.updateContactCustomFieldValue(params);
  }

  @ApiOperation({ summary: 'Delete multiple contacts by ID' })
  @RequirePermission('audience:contacts_edit')
  @Post('/bulk-delete')
  async bulkDelete(@Body() params: BulkDeleteContactsDto): Promise<{ deleted: number }> {
    return this.contactsService.bulkDelete(params.ids);
  }

  @ApiOperation({ summary: 'Delete a contact by ID' })
  @RequirePermission('audience:contacts_edit')
  @Delete('/:id')
  async deleteOne(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.contactsService.deleteOne(id);
  }
}
