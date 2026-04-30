import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { ContactEntity } from './../../entities/contact.entity';
import { Repository, In, UpdateQueryBuilder, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from '../../providers/redis.provider';
import { ContactDto } from './contacts.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { ContactsPageDto } from './dto/contactsPage.dto';
import { ContactCustomField } from '../services/services.dto';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { ContactCustomFieldEntity } from '../../entities/contact-custom-field.entity';
import { CustomFieldsEntity } from '../../entities/custom-fields.entity';
import { ContactBatch } from './interfaces';
import { AccountsService } from '../accounts/accounts.service';
import { ContactTagEntity } from 'src/entities/contact-tag.entity';
import { SuppressionEntity } from 'src/entities/suppression.entity';
import { ClsService } from 'nestjs-cls';
import { ContactDeviceEntity } from 'src/entities/contact-device.entity';
import { CustomEventService } from '../custom-events/custom-events.service';
import dayjs from 'dayjs';
import { AccountEntity } from 'src/entities/account.entity';
import { SuppressedsPageDto } from './dto/suppressedsPage.dto';
import { ContactAutomationEntity } from 'src/entities/contact-automation.entity';
import { EventsLogEntity } from 'src/entities/events-log.entity';
import { AuditService } from './../../utils/audits/audit.service';
import { maskEmail } from '../../utils/masking/email-masker';
import * as csv from 'fast-csv';
const CsvParser = require('json2csv').Parser;

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    @InjectRepository(ContactEntity)
    private readonly contactRepository: Repository<ContactEntity>,
    @InjectRepository(ContactAutomationEntity)
    private readonly contactAutomationRepository: Repository<ContactAutomationEntity>,
    @InjectRepository(EventsLogEntity)
    private readonly eventLogRepository: Repository<EventsLogEntity>,
    @InjectRepository(ContactTagEntity)
    private readonly contactTagRepository: Repository<ContactTagEntity>,
    @InjectRepository(ContactCustomFieldEntity)
    private readonly contactCustomFieldsRepository: Repository<ContactCustomFieldEntity>,
    @InjectRepository(ContactDeviceEntity)
    private readonly contactDeviceRepository: Repository<ContactDeviceEntity>,
    @InjectRepository(SuppressionEntity)
    private readonly suppressionRepository: Repository<SuppressionEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    private readonly customFieldService: CustomFieldsService,
    private readonly customEventService: CustomEventService,
    private readonly accountsService: AccountsService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
    private readonly cls: ClsService,
  ) {}

  async findAll(): Promise<Array<ContactEntity>> {
    try {
      const contacts = await this.contactRepository.find({
        where: {
          accountId: this.cls.get('accountId'),
        },
        order: {
          createdAtDate: 'DESC',
        },
      });
      return contacts.map((contact) => ({
        ...contact,
        email: contact.maskedEmail ?? maskEmail(contact.email),
      })) as ContactEntity[];
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findAllSuppressed(): Promise<Array<SuppressionEntity>> {
    try {
      const suppressions = await this.suppressionRepository.find({
        where: {
          groupId: 1,
        },
        order: {
          unsubscribedAt: 'DESC',
          blockedAt: 'DESC',
        },
      });

      // Replace email with maskedEmail for each suppression
      return suppressions.map((suppression) => ({
        ...suppression,
        email: suppression.maskedEmail || suppression.email,
      })) as SuppressionEntity[];
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findAllSuppressedPaginated(params: SuppressedsPageDto): Promise<PaginationDto<SuppressionEntity>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'unsubscribed_at';
      const order = params.order ? params.order : 'DESC';

      const query = this.suppressionRepository
        .createQueryBuilder('suppressions')
        .andWhere('suppressions.group_id = :groupId', { groupId: 1 })
        .andWhere(this.buildBlockedFilter(params))
        .andWhere(params.title ? `suppressions.email LIKE :filter` : '1=1', {
          filter: `%${params.title ?? ''}%`,
        });

      if (params.startDate && params.endDate) {
        query.andWhere('unsubscribed_at BETWEEN :startDate AND :endDate', {
          startDate: params.startDate,
          endDate: params.endDate,
        });
      }

      if (params.countOnly && params.countOnly == true) {
        const results = await query.getCount();
        return new PaginationDto<SuppressionEntity>({
          results: [],
          total: results,
        });
      }

      if (sortBy === 'created_at_date') {
        query.addOrderBy('contacts.id', order);
      }

      if (params.emails && params.emails.length) {
        query.andWhere('suppressions.email IN (:...emails)', { emails: params.emails });
      }

      const results = await query
        .orderBy(`suppressions.${sortBy}`, `${order}`)
        .select([`*`])
        .offset((params.page - 1) * params.itemsPerPage)
        .limit(params.itemsPerPage)
        .getRawMany();

      // Operator-facing list: emails are intentionally returned in clear so the
      // operator can identify whom to remove. They're already inside an
      // authenticated, permission-gated route.
      return new PaginationDto<SuppressionEntity>({
        results,
        total: results.length,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  generateParametrizedSelectQuery(params: ContactsPageDto, simpleQuery?: boolean) {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'created_at_date';
      const order = params.order ? params.order : 'DESC';

      if (params.segments?.length) {
        params.tags = [...(params.tags || []), ...params.segments];
      }

      const query = this.contactRepository
        .createQueryBuilder('contacts')
        .where(`contacts.account_id = ${this.cls.get('accountId')}`)
        .andWhere('contacts.email IS NOT NULL');

      if (params.title) {
        this.filterContactsBySpecificEmail(query, params);
      }

      if (params.tags?.length) {
        this.filterContactsByTags(query, params);
      }

      if (params.startDate && params.endDate) {
        this.filterContactsByDate(query, params);
      }

      if (params.contacts && params.contacts.length) {
        this.filterSpecificContacts(query, params);
      }

      if (simpleQuery) {
        return query;
      }

      query.orderBy(`contacts.${sortBy}`, order).select([`*`]);
      return query;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private filterContactsBySpecificEmail(query: SelectQueryBuilder<ContactEntity>, params: ContactsPageDto) {
    query.andWhere(`contacts.email LIKE :filter`, {
      filter: `%${params.title ?? ''}%`,
    });
  }

  private filterSpecificContacts(query: SelectQueryBuilder<ContactEntity>, params: ContactsPageDto) {
    query.andWhere('contacts.id IN (:...contactsIds)', { contactsIds: params.contacts });
  }

  private filterContactsByDate(query: SelectQueryBuilder<ContactEntity>, params: ContactsPageDto) {
    query.andWhere('created_at_date BETWEEN :startDate AND :endDate', {
      startDate: params.startDate,
      endDate: params.endDate,
    });
  }

  async exportInit(params: ContactsPageDto, currentUser?, userAgent?, ipAddress?) {
    try {
      await this.auditService.createAudit({
        accountId: this.cls.get('accountId'),
        entity: 'contacts',
        entityId: 1,
        type: 'export',
        newValues: await JSON.parse(JSON.stringify(params)),
        user: currentUser,
        ipAddress,
        userAgent,
      });
      if (this.cls.get('isInternalAccount')) {
        return {
          exportId: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          estimatedTotal: 1,
        };
      }
      const query = this.generateParametrizedSelectQuery(params, true);
      const total = await query.getCount();
      return {
        exportId: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        estimatedTotal: total,
      };
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async exportContactsStream(params: ContactsPageDto, response: any) {
    try {
      if (this.cls.get('isInternalAccount')) {
        return;
      }
      const exportId = params.exportId;
      const total = params.exportTotal;

      const query = this.generateParametrizedSelectQuery(params);

      // Initialize progress in Redis
      await this.updateExportStatus(exportId, 'starting', 0, total, 0, null);

      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');

      const csvStream = csv.format({
        headers: ['name', 'email', 'status', 'created_at'],
        writeHeaders: true,
        transform: (row: any) => ({
          name: `${row.first_name}${row.last_name ? ` ${row.last_name}` : ''}`,
          email: row.email || '',
          status: this.getStatus(row),
          created_at: row.created_at || '',
        }),
      });

      csvStream.pipe(response);

      // Update progress with total
      await this.updateExportStatus(exportId, 'processing', 0, total, 0, null);

      const stream = await query.stream();
      let processedCount = 0;

      return new Promise((resolve, reject) => {
        stream.on('data', async (data: any) => {
          try {
            const contact = data as any;
            if (contact && typeof contact === 'object' && contact.email) {
              csvStream.write(contact);
              processedCount++;

              if (processedCount % 100 === 0 || processedCount === total) {
                //update progress without await blocking
                const progress = total > 0 ? Math.round((processedCount / total) * 100) : 0;
                this.updateExportStatus(exportId, 'processing', progress, total, processedCount, null).catch((e) => {
                  console.error('Error updating export status:', e);
                });
              }
            }
          } catch (error) {
            console.error('Error processing contact row:', error);
            await this.updateExportStatus(exportId, 'error', 0, total, processedCount, error.message);
          }
        });

        stream.on('end', async () => {
          csvStream.end();
          // Mark as completed
          await this.updateExportStatus(exportId, 'completed', 100, total, processedCount, null);
          resolve(true);
        });

        stream.on('error', async (error) => {
          console.error('Stream error:', error);
          csvStream.destroy();
          await this.updateExportStatus(exportId, 'error', 0, total, processedCount, error.message);
          reject(error);
        });

        csvStream.on('error', async (error) => {
          console.error('CSV Stream error:', error);
          await this.updateExportStatus(exportId, 'error', 0, total, processedCount, error.message);
          reject(error);
        });
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getExportStatus(exportId: string): Promise<any> {
    try {
      const redisClient = this.redisService.getClient();
      const progressData = await redisClient.get(`export_progress:${exportId}`);

      if (!progressData) {
        throw new HttpException('Export not found', HttpStatus.NOT_FOUND);
      }

      return JSON.parse(progressData);
    } catch (e) {
      console.error(e);
      if (e instanceof HttpException) {
        throw e;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateExportStatus(exportId: string, status: string, progress: number, total: number, processedCount: number, error: string) {
    try {
      const redisClient = this.redisService.getClient();
      await redisClient.set(`export_progress:${exportId}`, JSON.stringify({ status, progress, total, processedCount, error }), 'EX', 60 * 60 * 24);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findAllPaginated(params: ContactsPageDto, exportContacts?: boolean, currentUser?, userAgent?, ipAddress?): Promise<PaginationDto<ContactEntity>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'created_at_date';
      const order = params.order ? params.order : 'DESC';

      if (params.segments?.length) {
        params.tags = [...(params.tags || []), ...params.segments];
      }

      const subQuery = `SELECT contacts.id contact_id, jsonb_object_agg(id, to_jsonb(tg.*)) tags
        FROM contacts_tags ctg INNER JOIN tags tg ON tg.id = ctg.tag_id
        WHERE ctg.account_id = ${this.cls.get('accountId')}
        AND ctg.contact_id = contacts.id`;

      const query = this.contactRepository
        .createQueryBuilder('contacts')
        .leftJoin(
          (qb) => {
            qb.getQuery = () => `LATERAL (${subQuery})`;
            qb.setParameters({});
            return qb;
          },
          `sub`,
          `contacts.id = sub.contact_id`,
        )
        .andWhere({ accountId: this.cls.get('accountId') });

      if (params.title) {
        this.filterContactsBySpecificEmail(query, params);
      }

      if (params.tags?.length) {
        this.filterContactsByTags(query, params);
      }

      if (params.startDate && params.endDate) {
        this.filterContactsByDate(query, params);
      }

      if (params.isUnsubscribed !== undefined) {
        query.andWhere('contacts.is_unsubscribed = :isUnsubscribed', { isUnsubscribed: params.isUnsubscribed });
      }

      if (params.hasBounced !== undefined) {
        query.andWhere('contacts.has_bounced = :hasBounced', { hasBounced: params.hasBounced });
      }

      if (params.isBlocked !== undefined) {
        query.andWhere('contacts.is_blocked = :isBlocked', { isBlocked: params.isBlocked });
      }

      if (params.isActive !== undefined) {
        query.andWhere('contacts.is_active = :isActive', { isActive: params.isActive });
      }

      if (params.countOnly && params.countOnly == true) {
        const results = await query.getCount();
        return new PaginationDto<ContactEntity>({
          results: [],
          total: results,
        });
      }

      if (sortBy === 'created_at_date') {
        query.addOrderBy('contacts.id', order);
      }

      if (params.contacts && params.contacts.length) {
        this.filterSpecificContacts(query, params);
      }

      const results = await query
        .orderBy(`contacts.${sortBy}`, `${order}`)
        .select([`*`])
        .offset((params.page - 1) * params.itemsPerPage)
        .limit(params.itemsPerPage)
        .getRawMany();

      if (exportContacts) {
        if (this.cls.get('isInternalAccount')) {
          await this.auditService.createAudit({
            accountId: this.cls.get('accountId'),
            entity: 'contacts',
            entityId: 1,
            type: 'export',
            newValues: await JSON.parse(JSON.stringify(params)),
            user: currentUser,
            ipAddress,
            userAgent,
          });
          return;
        }
        const headers = ['name', 'email', 'status', 'created_at'];
        const contacts = results.map((contact) => {
          if (contact.email) {
            return {
              name: `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ''}`,
              email: contact.email,
              status: this.getStatus(contact),
              created_at: contact.created_at,
            };
          }
        });
        const csvParser = new CsvParser({ headers });
        return csvParser.parse(contacts);
      }

      const maskedResults = results.map((result) => ({
        ...result,
        email: maskEmail(result.email),
      }));

      return new PaginationDto<ContactEntity>({
        results: maskedResults,
        total: results.length,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private filterContactsByTags(query: SelectQueryBuilder<ContactEntity>, params: ContactsPageDto) {
    query.andWhere(
      `EXISTS (
              SELECT 1 
              FROM contacts_tags ctg 
              WHERE ctg.account_id = ${this.cls.get('accountId')}
              AND ctg.contact_id = contacts.id 
              AND ctg.tag_id IN (:...tags)
            )`,
      { tags: params.tags },
    );
  }

  getStatus(contact: any) {
    if (contact.is_active === false) {
      return 'Inactive';
    }
    if (contact.has_bounced) {
      return 'Bounced';
    }
    if (contact.is_unsubscribed) {
      return 'Unsubscribed';
    }
    if (!contact.is_valid) {
      return 'Invalid';
    }

    return 'Active';
  }

  async getTotal(params: ContactsPageDto) {
    return await this.contactRepository
      .createQueryBuilder('contacts')
      .select([`COUNT(*) as total`])
      .where('account_id = :accountId AND created_at_date BETWEEN :startDate AND :endDate', {
        startDate: params.startDate,
        endDate: params.endDate,
        accountId: this.cls.get('accountId'),
      })
      .getRawOne();
  }

  private isUuid(value: string): boolean {
    return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) || /^[a-f0-9]{40}$/i.test(value);
  }

  async findOneByIdentifier(identifier: string): Promise<ContactEntity> {
    const isUuid = this.isUuid(identifier);
    return this.findOneById(identifier, isUuid);
  }

  async findOneById(identifier: string | number, byUuid = false): Promise<ContactEntity> {
    try {
      const contactCondition = byUuid ? 'ct.uuid = $1' : 'ct.id = $1';
      const subQueryCondition = byUuid ? `(SELECT id FROM contacts WHERE uuid = $1 AND account_id = $2)` : '$1';

      const result = await this.contactRepository.query(
        `
      WITH contactsAutomations as (
        SELECT
          contact_id,
          jsonb_agg(jsonb_build_object('automationTitle', automation_title, 'createdAt', created_at, 'status', status)) AS contact_automation
        FROM contacts_automations
        where contact_id = ${subQueryCondition} and account_id = $2
        GROUP BY
          contact_id
        ),
        contactsTags as (
          SELECT
            contact_id,
            jsonb_agg(DISTINCT jsonb_build_object('id', tg.id, 'name', tg.name)) AS contact_tag
          FROM contacts_tags ctg
          LEFT JOIN tags tg ON tg.id = ctg.tag_id
          where ctg.contact_id = ${subQueryCondition} and ctg.account_id = $2
          GROUP BY
            contact_id
        ),
        contactsCustomFields as (
            SELECT
          contact_id,
          jsonb_agg(jsonb_build_object('title', cf.title, 'value', ccf.value, 'customFieldId', cf.id, 'createdAt', cf.created_at, 'updatedAt', cf.updated_at)) AS custom_fields
        FROM contacts_custom_fields ccf
        LEFT JOIN custom_fields cf ON cf.id = ccf.custom_field_id
        where ccf.contact_id = ${subQueryCondition} and ccf.account_id = $2
        GROUP BY
          contact_id
        ),
        contactsDevices as (
          SELECT
            contact_id,
            jsonb_agg(jsonb_build_object('deviceId', cd.id, 'type', cd.type, 'token', cd.token, 'isActive', cd.is_active, 'isUnsubscribed', cd.is_unsubscribed, 'deviceType', cd.device_type, 'operatingSystem', cd.os, 'browser', cd.browser, 'browserVersion', cd.browser_version, 'resolution', cd.resolution, 'subscriptionUrl', cd.subscription_url, 'latestVisitedUrl', cd.latest_visited_url, 'lastSession', cd.last_session, 'lastSent', cd.last_sent, 'lastSentDate', cd.last_sent_date, 'lastView', cd.last_view, 'lastViewDate', cd.last_view_date, 'lastClick', cd.last_click, 'lastClickDate', cd.last_click_date, 'createdAt', cd.created_at, 'updatedAt', cd.updated_at, 'lastDelivered', cd.last_delivered, 'lastDeliveredDate', cd.last_delivered_date)) AS contacts_devices
          FROM contacts_devices cd
          where cd.contact_id = ${subQueryCondition} and cd.account_id = $2
          GROUP BY
            contact_id
        )

        select ct.*, contactsAutomations.contact_automation, contactsTags.contact_tag, contactsCustomFields.custom_fields, contactsDevices.contacts_devices from contacts ct
        LEFT JOIN contactsAutomations ON contactsAutomations.contact_id = ct.id
        LEFT JOIN contactsTags ON contactsTags.contact_id = ct.id
        LEFT JOIN contactsCustomFields ON contactsCustomFields.contact_id = ct.id
        LEFT JOIN contactsDevices ON contactsDevices.contact_id = ct.id
        where ${contactCondition} and ct.account_id = $2
      `,
        [identifier, this.cls.get('accountId')],
      );

      const returnObject: any = {};
      Object.keys(result[0]).forEach((key) => {
        returnObject[this.snakeToCamelCase(key)] = result[0][key];
      });

      if (returnObject.email) {
        returnObject.email = maskEmail(returnObject.email);
      }

      return returnObject;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  snakeToCamelCase(key) {
    return key.replace(/(_\w)/g, (value) => value[1].toUpperCase());
  }

  async findByProperty(options: { email?: string; id?: number; uuid?: string; isCompleted?: boolean }): Promise<ContactEntity> {
    try {
      const contact = await this.contactRepository
        .createQueryBuilder('contacts')
        .where({
          accountId: this.cls.get('accountId'),
          ...(options.email ? { email: options.email.toLowerCase() } : {}),
          ...(options.id ? { id: options.id } : {}),
          ...(options.uuid ? { uuid: options.uuid } : {}),
        })
        .getOne();

      if (options.isCompleted && contact) {
        return this.findOneById(contact.id);
      }

      return contact;
    } catch (e) {
      console.log(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async update(contactDto: ContactDto, contactRepository: ContactEntity): Promise<ContactDto> {
    try {
      // Build a plain patch from the dto so TypeORM's UPDATE doesn't trip on
      // non-column fields (fullName/maskedEmail set in @AfterLoad) or eager
      // relations (contactTag, customFields, contactAutomation, contactDevices)
      // that ContactEntity carries when loaded.
      const { id: _id, ...patch } = contactDto;
      await this.contactRepository.update(contactRepository.id, patch as Partial<ContactEntity>);
      return { ...contactRepository, ...patch };
    } catch (e) {
      if (e?.code === PostgresErrorCode.UniqueViolation) {
        throw new ConflictException('A contact with that email already exists in this account');
      }
      if (e instanceof HttpException) throw e;
      this.logger.error('Failed to update contact', e?.stack || e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(contactDto: ContactDto): Promise<ContactDto> {
    try {
      return this.contactRepository.save(contactDto);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async count(accountId?: number): Promise<number> {
    try {
      const id = accountId ? accountId : this.cls.get('accountId');
      const result = await this.contactRepository.createQueryBuilder('contact').where('contact.account_id = :accountId', { accountId: id }).getCount();
      return result;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findContactByEmail(emails: string[]): Promise<ContactEntity[]> {
    try {
      return await this.contactRepository
        .createQueryBuilder('contacts')
        .where({ email: In(emails), accountId: this.cls.get('accountId') })
        .getMany();
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async processContactsCustomFields(batch: ContactCustomField) {
    try {
      const objectReturn = [];
      const customFieldsBatch = new Set();

      for (const item of batch.contact) {
        objectReturn[item.email] = item.customFields;
        Object.keys(item.customFields).forEach((customField) => {
          customFieldsBatch.add(customField.toUpperCase());
        });
      }

      const contactsEmail = Object.keys(objectReturn);
      const customFieldsName = [...customFieldsBatch] as string[];

      const contacts = await this.findContactByEmail(contactsEmail);
      const customFields = await this.customFieldService.findByName(customFieldsName);
      const insertContactCustomFields = [];

      contacts.forEach((contact) => {
        const contactCustomFields = objectReturn[contact.email];

        for (const [key, value] of Object.entries(contactCustomFields)) {
          insertContactCustomFields.push({
            accountId: this.cls.get('accountId'),
            contactId: contact.id,
            customFieldId: this.getValueByCaseInsensitive(customFields, key),
            value: value,
          });
        }
      });

      const contactsCustomFieldsSliced = await this.getContactsCustomFieldsSlices(insertContactCustomFields);

      for (const item in contactsCustomFieldsSliced) {
        await this.updateContactCustomField(contactsCustomFieldsSliced[item]);
      }
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateContactCustomField(userCustomFields: any) {
    try {
      return this.contactCustomFieldsRepository
        .createQueryBuilder('contact_custom_field')
        .insert()
        .values(userCustomFields)
        .orUpdate(['value'], ['account_id', 'contact_id', 'custom_field_id'])
        .execute();
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateContactCustomFieldValue(params: any) {
    try {
      const result = await this.contactCustomFieldsRepository.query(
        `
        UPDATE contacts_custom_fields 
        SET value = $1, updated_at = CURRENT_TIMESTAMP
        WHERE ctid = (
          SELECT ctid 
          FROM contacts_custom_fields 
          WHERE account_id = $2
            AND contact_id = $3 
            AND custom_field_id = $4 
            AND value = $5
          LIMIT 1
        )
      `,
        [params.value, this.cls.get('accountId'), params.contactId, params.customFieldId, params.oldValue],
      );

      return { affected: result[1] || 0 };
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  getValueByCaseInsensitive(object: CustomFieldsEntity[], key: string): number {
    const filter = object.find((k) => k.name.toUpperCase() === key.toUpperCase());
    return filter?.id || 0;
  }

  async getContactsCustomFieldsSlices(contactsCustomField: any[]): Promise<Array<any>> {
    const batchLength = parseInt(process.env.LIMIT_CONTACT_CUSTOM_FIELD_BATCH);
    const contactsCustomFieldsSlices = [];

    for (let i = 0; i < contactsCustomField.length; i += batchLength) {
      contactsCustomFieldsSlices.push(contactsCustomField.slice(i, i + batchLength));
    }

    return contactsCustomFieldsSlices;
  }

  async dashboard(): Promise<any> {
    try {
      return await this.contactRepository
        .createQueryBuilder('contacts')
        .where({
          accountId: this.cls.get('accountId'),
        })
        .select([
          `SUM(1) total`,
          `SUM(CASE WHEN CURRENT_DATE = created_at_date  THEN 1 ELSE 0 END) current_date`,
          `SUM(CASE WHEN is_active = TRUE AND has_bounced = false AND is_unsubscribed = false  THEN 1 ELSE 0 END) active`,
          `SUM(CASE WHEN email_provider = 'Gmail' THEN 1 ELSE 0 END) gmail`,
          `SUM(CASE WHEN email_provider = 'iCloud' THEN 1 ELSE 0 END) icloud`,
          `SUM(CASE WHEN email_provider = 'Microsoft' THEN 1 ELSE 0 END) microsoft`,
          `SUM(CASE WHEN email_provider = 'Other' THEN 1 ELSE 0 END) other`,
          `SUM(CASE WHEN email_provider = 'Yahoo' THEN 1 ELSE 0 END) yahoo`,
        ])
        .getRawOne();
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async importContacts(data: ContactBatch) {
    const accountId = this.cls.get<number>('accountId');

    const parsed = data.contacts
      .map((row: any) => {
        const contact: Partial<ContactEntity> = {};
        const customFields: Record<string, string> = {};

        row.forEach((cell, index) => {
          const header = data.headers[`${index}`];
          if (!header || header.type === 'ignore') return;

          if (header.type === 'customField') {
            customFields[header.value] = cell;
            return;
          }

          if (header.type === 'contacts') {
            if (header.value === 'fullName') {
              const [first, ...rest] = String(cell ?? '').split(' ');
              contact.firstName = first;
              contact.lastName = rest.join(' ');
              return;
            }
            (contact as any)[header.value] = cell;
          }
        });

        return { contact, customFields };
      })
      .filter(({ contact }) => contact.email || contact.phone || contact.whatsapp);

    if (!parsed.length) return { imported: 0 };

    const emails = parsed
      .map((p) => p.contact.email)
      .filter(Boolean)
      .map((e) => e.toLowerCase());
    const existing = emails.length ? await this.findContactByEmail(emails) : [];
    const existingByEmail = new Map(existing.map((c) => [c.email.toLowerCase(), c]));

    const customFieldDefs = await this.customFieldService.findAll();
    const customFieldByName = new Map(customFieldDefs.map((cf: CustomFieldsEntity) => [cf.name, cf]));

    const tagEntities = data.tags?.length
      ? await this.contactTagRepository.manager.getRepository('tags').find({
          where: { accountId, name: In(data.tags) },
        } as any)
      : [];

    let imported = 0;
    for (const { contact, customFields } of parsed) {
      const existingContact = contact.email ? existingByEmail.get(contact.email.toLowerCase()) : null;

      const saved = await this.contactRepository.save({
        ...(existingContact ?? { accountId, isActive: true, isValid: true }),
        ...contact,
        accountId,
      } as ContactEntity);

      const cfRows: Partial<ContactCustomFieldEntity>[] = [];
      for (const [name, value] of Object.entries(customFields)) {
        const def = customFieldByName.get(name);
        if (!def || value === undefined || value === null || value === '') continue;
        cfRows.push({ contactId: saved.id, customFieldId: def.id, value: String(value) });
      }
      if (cfRows.length) {
        await this.contactCustomFieldsRepository.createQueryBuilder().insert().values(cfRows).orUpdate(['value'], ['contact_id', 'custom_field_id']).execute();
      }

      if (tagEntities.length) {
        const tagRows = tagEntities.map((t: any) => ({ contactId: saved.id, tagId: t.id, accountId }));
        await this.contactTagRepository.createQueryBuilder().insert().values(tagRows).orIgnore().execute();
      }

      imported += 1;
    }

    return { imported };
  }

  async updateTag(params: { contacts: number[]; tags: number[]; action: 'add' | 'remove' }) {
    const accountId = this.cls.get<number>('accountId');
    const contactIds: number[] = params.contacts ?? [];
    const tagIds: number[] = params.tags ?? [];
    if (!contactIds.length || !tagIds.length) {
      return { affected: 0 };
    }

    if (params.action === 'add') {
      // contacts_tags has no unique constraint on (account_id, contact_id, tag_id),
      // so .orIgnore() is a no-op — filter existing pairs in-memory before insert
      // to keep the relation idempotent.
      const existing = await this.contactTagRepository
        .createQueryBuilder('ct')
        .select(['ct.contactId', 'ct.tagId'])
        .where('ct.account_id = :accountId AND ct.contact_id IN (:...contactIds) AND ct.tag_id IN (:...tagIds)', {
          accountId,
          contactIds,
          tagIds,
        })
        .getMany();
      const existingPairs = new Set(existing.map((row) => `${row.contactId}:${row.tagId}`));

      const values = contactIds.flatMap((contactId) => tagIds.filter((tagId) => !existingPairs.has(`${contactId}:${tagId}`)).map((tagId) => ({ contactId, tagId, accountId })));
      if (!values.length) {
        return { affected: 0 };
      }
      return this.contactTagRepository.createQueryBuilder().insert().into('contacts_tags').values(values).execute();
    }

    if (params.action === 'remove') {
      // TODO: Remove tag should stop running automation
      return this.contactTagRepository
        .createQueryBuilder()
        .delete()
        .from('contacts_tags')
        .where('account_id = :accountId AND contact_id IN (:...contactIds) AND tag_id IN (:...tagIds)', {
          accountId,
          contactIds,
          tagIds,
        })
        .execute();
    }
  }

  async bulkUnsubscribe(params: { emails: string[]; allAccounts?: boolean; block?: boolean }) {
    const emails = [...params.emails];
    const date = new Date();
    if (!emails.length) {
      return;
    }

    // The `allAccounts` and `is_internal` flags were a SaaS multi-tenant concept
    // where suppression cascaded across all customer accounts managed by the
    // operator. In OSS each deployment owns its own data, so we always scope
    // both the contact update and the suppression record to the current account.
    const accountId = this.cls.get<number>('accountId');
    if (!accountId) {
      throw new BadRequestException('Account context is required. Send the Account-Id header.');
    }

    const queryRunner = this.contactRepository.manager.connection.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      const block = params.block;
      const groupId = 1;

      const query = queryRunner.manager.createQueryBuilder().update('contacts');
      if (block) {
        query.set({ isBlocked: true, blockedAt: date });
      } else {
        query.set({ isUnsubscribed: true, unsubscribedAt: date });
      }
      query.where('email IN (:...emails) AND account_id = :accountId', { emails, accountId });

      await query.execute();

      const contacts = [
        ...new Map(
          emails.map((email: string) => [
            email,
            {
              groupId,
              email,
              ...(block ? { isBlocked: true, blockedAt: date, isUnsubscribed: false, unsubscribedAt: null } : { isUnsubscribed: true, unsubscribedAt: date }),
            },
          ]),
        ).values(),
      ];

      await queryRunner.manager.upsert(SuppressionEntity, contacts, ['email', 'groupId']);

      await queryRunner.commitTransaction();

      const redisClient = this.redisService.getClient();
      const redisExpiration = 60 * 60 * 168;
      // Pipeline so a 1k-email bulk doesn't pay 1k network round-trips. Each
      // command is independent — no need for a Redis MULTI transaction here.
      const pipeline = redisClient.pipeline();
      for (const email of emails) {
        if (block) {
          pipeline.set(`${accountId}:blocked:${email}`, 'true');
        } else {
          pipeline.set(`${accountId}:unsubscribed:${email}`, 'true', 'EX', redisExpiration);
        }
      }
      await pipeline.exec();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err instanceof HttpException) throw err;
      this.logger.error('Failed to bulk unsubscribe', err?.stack || err);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await queryRunner.release();
    }
  }

  async bulkResubscribe(params: { emails: string[]; block?: boolean }) {
    const emails = [...(params.emails ?? [])];
    if (!emails.length) {
      return;
    }

    const accountId = this.cls.get<number>('accountId');
    if (!accountId) {
      throw new BadRequestException('Account context is required. Send the Account-Id header.');
    }

    const block = !!params.block;
    const groupId = 1;

    const queryRunner = this.contactRepository.manager.connection.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      // Clear the matching flag on the contact rows in this account.
      const contactPatch = block ? { isBlocked: false, blockedAt: null } : { isUnsubscribed: false, unsubscribedAt: null };
      await queryRunner.manager
        .createQueryBuilder()
        .update('contacts')
        .set(contactPatch)
        .where('email IN (:...emails) AND account_id = :accountId', { emails, accountId })
        .execute();

      // Drop suppression rows that match the type. bulkUnsubscribe only ever
      // sets one flag at a time, so a row in the requested type can be deleted
      // outright. If a future caller stores a row with both flags set, we'd
      // need to clear the flag and delete only when both are false instead.
      const suppressionDelete = queryRunner.manager.createQueryBuilder().delete().from('suppressions').where('group_id = :groupId AND email IN (:...emails)', { groupId, emails });
      if (block) {
        suppressionDelete.andWhere('is_blocked = TRUE');
      } else {
        suppressionDelete.andWhere('is_unsubscribed = TRUE');
      }
      await suppressionDelete.execute();

      await queryRunner.commitTransaction();

      const redisClient = this.redisService.getClient();
      const redisKeyPrefix = block ? 'blocked' : 'unsubscribed';
      const redisKeys = emails.map((email) => `${accountId}:${redisKeyPrefix}:${email}`);
      if (redisKeys.length) {
        await redisClient.del(...redisKeys);
      }
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err instanceof HttpException) throw err;
      this.logger.error('Failed to bulk resubscribe', err?.stack || err);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await queryRunner.release();
    }
  }

  generateUnsubscribeQuery(params: ContactsPageDto, countOnly = false): UpdateQueryBuilder<ContactEntity> | SelectQueryBuilder<ContactEntity> {
    try {
      if (params.segments?.length) {
        params.tags = [...(params.tags || []), ...params.segments];
      }

      let query: UpdateQueryBuilder<ContactEntity> | SelectQueryBuilder<ContactEntity> = this.contactRepository.createQueryBuilder('contacts');
      if (countOnly) {
        query = query.select('COUNT(1)');
      } else {
        query = query.update().set({
          isUnsubscribed: true,
          unsubscribedAt: () => 'CURRENT_TIMESTAMP',
          updatedAt: () => 'CURRENT_TIMESTAMP',
        });
      }
      query.where(`contacts.account_id = ${this.cls.get('accountId')}`).andWhere(params.title ? `contacts.email LIKE :filter` : '1=1', {
        filter: `%${params.title ?? ''}%`,
      });

      if (params.tags && params.tags.length > 0 && query instanceof UpdateQueryBuilder) {
        query.andWhere(
          `contacts.id IN (SELECT contact_id FROM contacts_tags WHERE account_id = ${this.cls.get('accountId')} AND tag_id IN (${params.tags.map((tag) => `'${tag}'`).join(',')}))`,
        );
      } else if (params.tags && params.tags.length > 0 && query instanceof SelectQueryBuilder) {
        query
          .leftJoin('contacts.contactTag', 'contact_tags')
          .andWhere(`contact_tags.tag_id IN (${params.tags.map((tag) => `'${tag}'`).join(',')})`)
          .andWhere(`contact_tags.account_id = ${this.cls.get('accountId')}`);
      }

      if (params.startDate && params.endDate) {
        query.andWhere('created_at_date BETWEEN :startDate AND :endDate', {
          startDate: params.startDate,
          endDate: params.endDate,
        });
      }

      if (params.contacts && params.contacts.length) {
        query.andWhere('contacts.id IN (:...contactsIds)', { contactsIds: params.contacts });
      }

      if (query instanceof SelectQueryBuilder && countOnly) {
        return query;
      }

      if (query instanceof UpdateQueryBuilder) {
        query.returning('email');
      }

      return query;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async countUnsubscribe(params: ContactsPageDto) {
    const query = this.generateUnsubscribeQuery(params, true) as SelectQueryBuilder<ContactEntity>;
    const result = await query.getCount();
    return result;
  }

  async unsubscribe(params: ContactsPageDto) {
    const query = this.generateUnsubscribeQuery(params) as UpdateQueryBuilder<ContactEntity>;
    const result = await query.execute();
    const emails = result.raw.map((row: any) => row.email);
    const redisClient = this.redisService.getClient();
    const redisExpiration = 60 * 60 * 168;
    for (const email of emails) {
      await redisClient.set(`${this.cls.get('accountId')}:unsubscribed:${email}`, 'true', 'EX', redisExpiration);
    }

    return emails.length;
  }

  async cleanPushDevices() {
    const accounts = await this.accountsService.getAccountsByWebpush();
    const cleanPushDays = parseInt(process.env.CLEAN_PUSH_DAYS) || 30;
    await Promise.all(
      accounts.map(async (account) => {
        const query = `
          UPDATE contacts_devices SET is_active = false, updated_at = CURRENT_DATE
            WHERE account_id = ${account.account_id}
            AND type = 'web-push'
            AND created_at < CURRENT_DATE - ${cleanPushDays}
            AND last_sent_date > CURRENT_DATE - ${cleanPushDays}
            AND last_delivered_date < CURRENT_DATE - ${cleanPushDays};
        `;
        await this.contactDeviceRepository.query(query);
      }),
    );
  }

  async removeInvalidContactsDevices() {
    const accounts = await this.accountsService.getAccountsByWebpush();
    const removePushDays = parseInt(process.env.REMOVE_PUSH_DAYS) || 15;

    await Promise.all(
      accounts.map(async ({ account_id }) => {
        const query = `
          CREATE TEMP TABLE temp_deleted_contacts_p${account_id} (contact_id INT);
          CREATE TEMP TABLE temp_deleted_contacts_devices_p${account_id} (contact_id INT);
          
          WITH deleted_devices AS (
            DELETE FROM contacts_devices 
              WHERE account_id = ${account_id}
              AND is_active = false 
              AND last_delivered_date <= CURRENT_DATE - ${removePushDays}
              RETURNING contact_id
          )
          INSERT INTO temp_deleted_contacts_devices_p${account_id} 
			    (SELECT contact_id FROM deleted_devices);
          WITH deleted_contacts AS (
            DELETE FROM contacts
              WHERE account_id = ${account_id}
                AND has_email = false
                AND has_phone = false
                AND has_whatsapp = false
                AND has_web_push = true
                AND id IN (
                  SELECT contact_id FROM temp_deleted_contacts_devices_p${account_id}  
                  WHERE contact_id NOT IN (SELECT contact_id FROM contacts_devices
                  WHERE account_id = ${account_id} AND contact_id IN (SELECT contact_id FROM temp_deleted_contacts_devices_p${account_id}))
                )
              RETURNING id
          )
          INSERT INTO temp_deleted_contacts_p${account_id} 
			    (SELECT id FROM deleted_contacts);

          UPDATE contacts SET has_web_push = false
          WHERE account_id = ${account_id}
          AND 
            (
              has_email = true
              OR has_phone = true
              OR has_whatsapp = true
            )
          AND has_web_push = true
          AND id IN (
            SELECT contact_id FROM temp_deleted_contacts_devices_p${account_id}  
            WHERE contact_id NOT IN (SELECT contact_id FROM contacts_devices
            WHERE account_id = ${account_id} AND contact_id IN (SELECT contact_id FROM temp_deleted_contacts_devices_p${account_id}))
          );

          DELETE FROM contacts_tags
            WHERE account_id = ${account_id} AND contact_id IN (SELECT contact_id FROM temp_deleted_contacts_p${account_id});
          DELETE FROM contacts_custom_fields
            WHERE account_id = ${account_id} AND contact_id IN (SELECT contact_id FROM temp_deleted_contacts_p${account_id});
          DELETE FROM contacts_automations
            WHERE account_id = ${account_id} AND contact_id IN (SELECT contact_id FROM temp_deleted_contacts_p${account_id});

          DROP TABLE temp_deleted_contacts_p${account_id};
          DROP TABLE temp_deleted_contacts_devices_p${account_id};
        `;
        await this.contactDeviceRepository.query(query);
      }),
    );
  }

  async unsubscribedByEmail(accountId: number, email: string) {
    await this.contactRepository
      .createQueryBuilder('contacts')
      .update()
      .set({ isUnsubscribed: true, unsubscribedAt: new Date() })
      .where('email = :email AND account_id = :account_id', {
        email: email,
        account_id: accountId,
      })
      .execute();
  }

  async updateContactsEvents() {
    const accounts = await this.customEventService.getAccountWithCustomEvents();
    if (!accounts.length) {
      return;
    }

    for (const accountId of accounts.map((account) => account.accountId)) {
      const uuidQuery = `UPDATE events_logs AS el 
        SET contact_id = ct.id, email = ct.email
        FROM contacts AS ct
        WHERE (
          (el.uuid is not null AND ct.uuid = el.uuid)
          OR 
          (el.email is not null AND ct.email = el.email)
        )
        AND el.time >= '${dayjs().utc().subtract(15, 'minute').format('YYYY-MM-DD HH:mm:ss')}'
        AND el.time < '${dayjs().utc().format('YYYY-MM-DD HH:mm:ss')}'
        AND el.uuid != 'None' 
        AND el.contact_id is null
        AND el.account_id = ${accountId}
        AND ct.account_id = ${accountId};`;

      const emailquery = `UPDATE events_logs AS el 
      SET contact_id = ct.id
      FROM contacts AS ct
      WHERE ct.email = el.email
      AND el.time >= '${dayjs().utc().subtract(15, 'minute').format('YYYY-MM-DD HH:mm:ss')}'
      AND el.time < '${dayjs().utc().format('YYYY-MM-DD HH:mm:ss')}'
      AND el.email is not null 
      AND el.contact_id is null
      AND el.account_id = ${accountId}
      AND ct.account_id = ${accountId};`;

      await this.contactDeviceRepository.query(uuidQuery);
      await this.contactDeviceRepository.query(emailquery);
    }
  }

  async findContactHistory(id: number, params: ContactsPageDto): Promise<PaginationDto<any>> {
    try {
      let automations = [];
      let events = [];

      const shouldFetchAutomations = !params.activities?.length || params.activities.includes('automation');

      if (shouldFetchAutomations) {
        const contactsAutomationsQuery = this.contactAutomationRepository
          .createQueryBuilder('ca')
          .select(['ca.*', "'automation' as type"])
          .where('ca.account_id = :accountId', { accountId: this.cls.get('accountId') })
          .andWhere('ca.contact_id = :contactId', { contactId: id })
          .orderBy('ca.created_at', 'DESC')
          .limit(params.itemsPerPage)
          .offset((params.page - 1) * params.itemsPerPage);

        if (params.startDate && params.endDate) {
          contactsAutomationsQuery.andWhere('ca.created_at BETWEEN :startDate AND :endDate', {
            startDate: params.startDate,
            endDate: params.endDate,
          });
        }

        automations = await contactsAutomationsQuery.getRawMany();
      }

      const shouldFetchEvents = !params.activities?.length || params.activities.includes('message') || params.activities.includes('custom_event');

      if (shouldFetchEvents) {
        const eventsQuery = this.eventLogRepository
          .createQueryBuilder('el')
          .select([
            'el.*',
            `CASE 
              WHEN el.message_type = 'custom_events' THEN ce.name 
              ELSE m.title 
            END as message_title`,
            `CASE 
              WHEN el.message_type = 'custom_events' THEN ce.properties 
              ELSE NULL 
            END as event_properties`,
            `CASE 
              WHEN el.message_type = 'custom_events' THEN 'custom_event' 
              ELSE 'message'
            END as type`,
            `CASE 
              WHEN el.message_type IS NULL AND m.type IS NOT NULL THEN m.type
              ELSE el.message_type
            END as message_type`,
          ])
          .leftJoin('messages', 'm', 'el.message_id = m.id AND (el.message_type != :customEvents OR el.message_type is null)', { customEvents: 'custom_events' })
          .leftJoin('custom_events', 'ce', 'el.event_id = ce.id AND el.message_type = :customEvents', { customEvents: 'custom_events' })
          .where('el.account_id = :accountId', { accountId: this.cls.get('accountId') })
          .andWhere('el.contact_id = :contactId', { contactId: id })
          .orderBy('el.time', 'DESC')
          .limit(params.itemsPerPage)
          .offset((params.page - 1) * params.itemsPerPage);

        if (params.startDate && params.endDate) {
          eventsQuery.andWhere('el.time BETWEEN :startDate AND :endDate', {
            startDate: params.startDate,
            endDate: params.endDate,
          });
        }

        if (params.activities?.length) {
          const activityConditions = [];

          if (params.activities.includes('custom_event')) {
            activityConditions.push("el.message_type = 'custom_events'");
          }

          if (params.activities.includes('message')) {
            activityConditions.push("el.message_type != 'custom_events'");
          }

          if (activityConditions.length) {
            eventsQuery.andWhere(`(${activityConditions.join(' OR ')})`);
          }
        }

        if (params.channels?.length) {
          eventsQuery.andWhere('el.message_type IN (:...channels)', {
            channels: params.channels.map((channel) => {
              switch (channel) {
                case 'email':
                  return 'email';
                case 'wpp':
                  return 'whatsapp';
                case 'web-push':
                  return 'web-push';
                case 'mobile-push':
                  return 'mobile-push';
                case 'sms':
                  return 'sms';
                default:
                  return channel;
              }
            }),
          });
        }

        try {
          events = await eventsQuery.getRawMany();
        } catch (e) {
          // events_logs lives in ClickHouse (events_logs_v2), not Postgres. Until the
          // cross-DB hydration is wired up, degrade to automations-only instead of 500ing
          // the contact edit page.
          this.logger.warn(`Contact event history unavailable: ${e?.message ?? e}`);
          events = [];
        }
      }

      const combinedData = [...automations, ...events];
      const total = combinedData.length;

      return new PaginationDto<any>({
        results: combinedData,
        total,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Deactivates contacts that have been inactive for a specified period.
   * Triggered nightly via the BullMQ scheduler (delayed job → HTTP loopback)
   * to identify and deactivate contacts that:
   * - Have email but no other communication channels (web push, mobile push, whatsapp)
   * - Have not opened any messages for the specified number of days (default: 180)
   * - Were created more than the specified number of days ago
   *
   * Processing is done in batches to minimize database load.
   */
  async deactivateInternalContacts() {
    try {
      const accounts = await this.accountsService.getInternalAccounts();
      const deactivateDays = parseInt(process.env.DEACTIVATE_CONTACTS_IN_DAYS) || 180;

      const BATCH_SIZE = 1000;

      for (const { id: accountId } of accounts) {
        console.log(`Processing deactivation contacts on account ${accountId}`);

        while (true) {
          try {
            await this.contactRepository.query('BEGIN');

            const selectResult = await this.contactRepository.query(`
                SELECT id
                FROM contacts 
                WHERE account_id = ${accountId}
                  AND is_active = TRUE
                  AND has_email = TRUE
                  AND has_web_push = FALSE
                  AND has_mobile_push = FALSE
                  AND has_whatsapp = FALSE
                  AND created_at_date < CURRENT_DATE - INTERVAL '${deactivateDays} days'
                  AND (last_open_date < CURRENT_DATE - INTERVAL '${deactivateDays} days' OR last_open_date IS NULL)
                LIMIT ${BATCH_SIZE}
                FOR UPDATE SKIP LOCKED
            `);

            const contactIds = selectResult.map((row: { id: number }) => row.id);

            if (contactIds.length === 0) {
              await this.contactRepository.query('COMMIT');

              console.log(`Finished deactivation contacts on account ${accountId}!`);
              break;
            }

            await this.contactRepository.query(`DELETE FROM contacts_tags WHERE account_id = $1 AND contact_id = ANY($2);`, [accountId, contactIds]);

            await this.contactRepository.query(`DELETE FROM contacts_automations WHERE account_id = $1 AND contact_id = ANY($2);`, [accountId, contactIds]);

            await this.contactRepository.query(`UPDATE contacts SET is_active = FALSE WHERE account_id = $1 AND id = ANY($2) RETURNING id;`, [accountId, contactIds]);

            await this.contactRepository.query('COMMIT');

            console.log(`Updated ${contactIds.length} contacts`);
          } catch (error) {
            console.error(`Error in deactivation batch for account ${accountId}:`, error);
            await this.contactRepository.query('ROLLBACK');
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error in deactivateContacts:', error);
      throw new HttpException('Error deactivating contacts', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private buildBlockedFilter(params: SuppressedsPageDto): string {
    if (params.type === 'blocked') {
      return 'suppressions.is_blocked = true';
    }
    if (params.type === 'unsubscribed') {
      return 'suppressions.is_blocked = false';
    }
    // Backward compatibility: fall back to blockedOnly boolean
    return params.blockedOnly ? 'suppressions.is_blocked = true' : 'suppressions.is_blocked = false';
  }
}
