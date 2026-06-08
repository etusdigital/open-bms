import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { ContactEntity } from './../../entities/contact.entity';
import { Repository, In, UpdateQueryBuilder, SelectQueryBuilder, EntityManager } from 'typeorm';
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
import { replaceSpecialChars } from '../../utils/utils.service';
import dayjs from 'dayjs';
import { AccountEntity } from 'src/entities/account.entity';
import { SuppressedsPageDto } from './dto/suppressedsPage.dto';
import { ContactAutomationEntity } from 'src/entities/contact-automation.entity';
import { AuditService } from './../../utils/audits/audit.service';
import { ClickhouseProvider } from '../../providers/clickhouse.provider';
import { maskEmail } from '../../utils/masking/email-masker';
import { EventPublisherService } from '../../providers/messaging/event-publisher.service';
import { EXCHANGES } from '@bms/messaging';
import { TagEntity } from 'src/entities/tag.entity';
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
    private readonly accountsService: AccountsService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
    private readonly cls: ClsService,
    private readonly eventPublisher: EventPublisherService,
    private readonly clickhouseProvider: ClickhouseProvider,
  ) {}

  // TODO(perf): N contacts × M tags becomes N×M serial publishes. Fine for the
  // v0.1.0 OSS ceiling; revisit with bounded concurrency or a batched envelope
  // once we see bulk-tag flows that hit it.
  private async publishTagEvents(
    action: 'add' | 'remove',
    accountId: number,
    pairs: Array<{ contact: { id: number; email?: string; uuid?: string }; tagName: string }>,
  ): Promise<void> {
    if (!pairs.length) return;
    for (const { contact, tagName } of pairs) {
      try {
        await this.eventPublisher.publish(
          EXCHANGES.tags,
          'tag.process',
          {
            // id is the SaaS lead-id slot; OSS doesn't carry leads through here.
            id: 0,
            startedAt: Date.now(),
            account: { id: accountId },
            contact: { id: contact.id, accountId, email: contact.email, uuid: contact.uuid },
            tagName,
          },
          { type: action },
        );
      } catch (err) {
        // DB already committed — don't fail the API response over a queue hiccup.
        // The contact will miss this automation trigger; surface it for ops.
        this.logger.error(`[publishTagEvents] failed to publish ${action} for contact=${contact.id} tag="${tagName}" account=${accountId}`, (err as Error)?.stack ?? err);
      }
    }
  }

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

      // Page-only fetch. `total` below intentionally reflects the page
      // size, not the total matching rows for the account. Counting the
      // full result set inline would add ~300ms on accounts with millions
      // of contacts (COUNT(*) is index-only but still scans), blocking
      // the list from rendering.
      //
      // Clients that need the real count should call either:
      //   - GET /contacts/dashboard for the unfiltered total (a cached
      //     aggregate the dashboard cards already consume), or
      //   - GET /contacts?countOnly=true&...filters for the filtered
      //     count (short-circuits to `query.getCount()` above).
      //
      // The Vue2 client orchestrated this for years; the React client
      // follows the same pattern. See use-contacts.ts → useContactsTotal.
      const results = await query
        .orderBy(`contacts.${sortBy}`, `${order}`)
        .select([`*`])
        .offset((params.page - 1) * params.itemsPerPage)
        .limit(params.itemsPerPage)
        .getRawMany();

      if (exportContacts) {
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

  // Bulk feed of contact<->custom-field VALUES for the Enterprise import worker.
  // The contacts list only embeds `tags`; custom field values live in
  // contacts_custom_fields and are otherwise only serialized per-contact by
  // findOneById. This paginates the join rows (account-scoped via the API key)
  // so the importer can stream them and rebuild the relation. `totalItems` is
  // omitted on purpose (no COUNT over a large table); the caller paginates
  // until a short page.
  async findCustomFieldValuesPaginated(params: ContactsPageDto): Promise<PaginationDto<any>> {
    try {
      const accountId = this.cls.get('accountId');
      const page = Number(params.page) || 1;
      const itemsPerPage = Number(params.itemsPerPage) || 1000;
      const results = await this.contactCustomFieldsRepository.query(
        `SELECT contact_id AS "contactId", custom_field_id AS "customFieldId", value, time, number
           FROM contacts_custom_fields
          WHERE account_id = $1
          ORDER BY contact_id, custom_field_id
          LIMIT $2 OFFSET $3`,
        [accountId, itemsPerPage, (page - 1) * itemsPerPage],
      );
      return new PaginationDto<any>({ results, page, itemsPerPage } as any);
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
    // Without an identifier the `where` would collapse to just `{ accountId }`
    // and `.getOne()` would return an arbitrary contact of the account — which
    // could make create() silently update the wrong contact. Require one.
    if (!options.email && !options.id && !options.uuid) {
      return null;
    }
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

  // Ingests a web-push subscription from web-push.js: resolves (or creates) the
  // contact, then upserts its ContactDevice (keyed by contact + token). Account
  // comes from CLS (api-key middleware). Returns the device id. Used by the
  // public /bms/leads web-push-subscription path.
  async upsertWebPushDevice(input: {
    contact: { email?: string; uuid?: string };
    device: { token: string; type?: string; os?: string; browser?: string; browserVersion?: string; deviceType?: string; resolution?: string; subscriptionUrl?: string };
  }): Promise<{ deviceId: number; contactId: number }> {
    const accountId = this.cls.get('accountId') as number;
    if (!accountId) throw new HttpException('Account context required', HttpStatus.UNAUTHORIZED);
    if (!input.device?.token) throw new HttpException('device.token is required', HttpStatus.BAD_REQUEST);

    // Resolve or create the contact. A web-push subscriber may be anonymous
    // (no email yet) — fall back to a uuid-only contact so the token isn't lost.
    let contact = await this.findByProperty({ email: input.contact?.email, uuid: input.contact?.uuid });
    if (!contact) {
      if (input.contact?.email) {
        await this.create({
          email: input.contact.email,
          firstName: '',
          lastName: '',
          phone: '',
          whatsapp: '',
          tagNames: [],
          city: '',
          region: '',
          country: '',
          postal: '',
          ip: undefined as unknown as string,
          latitude: undefined as unknown as number,
          longitude: undefined as unknown as number,
          timezone: '',
        });
        contact = await this.findByProperty({ email: input.contact.email });
      } else {
        // Anonymous subscriber: minimal contact row so the device has an owner.
        contact = await this.contactRepository.save(this.contactRepository.create({ accountId, hasWebPush: true } as Partial<ContactEntity>));
      }
    }
    if (!contact) throw new HttpException('Could not resolve contact', HttpStatus.INTERNAL_SERVER_ERROR);

    const now = new Date();
    // Upsert REAL pela chave única do banco (account_id, token) — NÃO por
    // (accountId, contactId, token). Um token web-push é re-emitido pelo navegador e
    // pode reaparecer sob outro contato (ex.: subscribe anônimo antes de o usuário
    // se identificar → depois o registro com e-mail). Buscar incluindo contactId não
    // achava o registro existente sob o contato anônimo, caía no INSERT e violava a
    // unique (account_id, token) → 500, e o token nunca migrava p/ o contato certo.
    // Agora: achou pela (account, token) → RE-HOME ao contato resolvido + reativa.
    const existing = await this.contactDeviceRepository.findOne({ where: { accountId, token: input.device.token } });
    if (existing) {
      existing.contactId = contact.id;
      existing.isActive = true;
      existing.isUnsubscribed = false;
      existing.lastSession = now;
      await this.contactDeviceRepository.save(existing);
      await this.contactRepository.update({ id: contact.id, accountId }, { hasWebPush: true } as Partial<ContactEntity>).catch(() => undefined);
      return { deviceId: existing.id, contactId: contact.id };
    }

    const device = await this.contactDeviceRepository.save(
      this.contactDeviceRepository.create({
        accountId,
        contactId: contact.id,
        type: input.device.type || 'web-push',
        token: input.device.token,
        isActive: true,
        isUnsubscribed: false,
        ip: '',
        deviceType: input.device.deviceType || '',
        os: input.device.os || '',
        browser: input.device.browser || '',
        browserVersion: input.device.browserVersion || '',
        resolution: input.device.resolution || '',
        subscriptionUrl: input.device.subscriptionUrl || '',
        latestVisitedUrl: input.device.subscriptionUrl || '',
        lastSession: now,
      } as Partial<ContactDeviceEntity>),
    );
    // Flag the contact so segment queries that filter has_web_push pick it up.
    await this.contactRepository.update({ id: contact.id, accountId }, { hasWebPush: true } as Partial<ContactEntity>).catch(() => undefined);
    return { deviceId: device.id, contactId: contact.id };
  }

  // Tracker (bmstrk.js) contact resolution for POST /c. Given an email or uuid,
  // returns the contact in the compact shape the on-page tracker expects so it can
  // (a) write the `bmsUUID` cookie — load-bearing for linking a later web-push
  // registration to the same contact — and (b) compute contactStats() for popup
  // segmentation. The flags mirror Enterprise's abbreviations; `uuid`/`email` are
  // the load-bearing fields, the rest are best-effort. Returns null when unknown.
  async resolveTrackerContact(query: { email?: string; uuid?: string }): Promise<Record<string, unknown> | null> {
    if (!query.email && !query.uuid) return null;
    const contact = await this.findByProperty({ email: query.email, uuid: query.uuid });
    if (!contact) return null;
    return {
      uuid: contact.uuid,
      email: contact.email || undefined,
      // best-effort flags consumed by contactStats() (display/segmentation only):
      b: contact.isBlocked || undefined, // blocked
      u: contact.isUnsubscribed || undefined, // unsubscribed
      cd: contact.createdAt || undefined, // created date
      lo: contact.lastOpen || undefined, // last open
    };
  }

  // Tracker tags lookup for POST /bms/cs. Returns the names of the tags currently
  // on the contact (used by the tracker to decide which opt-in template to show).
  async getTrackerContactTags(query: { uuid?: string; id?: number }): Promise<string[]> {
    const accountId = this.cls.get('accountId') as number;
    if (!accountId || (!query.uuid && !query.id)) return [];
    const contact = await this.findByProperty({ uuid: query.uuid, id: query.id });
    if (!contact) return [];
    const rows = await this.contactRepository.manager
      .query(`SELECT t.name FROM contacts_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.contact_id = $1 AND t.account_id = $2`, [contact.id, accountId])
      .catch(() => []);
    return (rows as Array<{ name: string }>).map((r) => r.name).filter(Boolean);
  }

  // Resolves tag names to TagEntity rows, scoped to the account. Tag names are
  // stored inconsistently — manual tags are lowercased by TagEntity
  // @BeforeInsert, but segment tags keep their original casing (createSegment
  // re-applies the raw name via update(), which skips @BeforeInsert). So the
  // lookup must be case-insensitive on both sides. Throws NotFoundException if
  // any name has no matching tag — never creates tags implicitly.
  private async resolveTagsByName(names: string[], accountId: number, manager?: EntityManager): Promise<TagEntity[]> {
    const normalized = (names ?? []).map((n) => n?.trim().toLowerCase()).filter((n): n is string => !!n);
    if (!normalized.length) return [];

    const uniqueNames = [...new Set(normalized)];

    const repo = (manager ?? this.contactTagRepository.manager).getRepository(TagEntity);
    const tags = await repo
      .createQueryBuilder('tag')
      .where('tag.account_id = :accountId', { accountId })
      .andWhere('LOWER(tag.name) IN (:...names)', { names: uniqueNames })
      .getMany();

    const foundNames = new Set(tags.map((t) => t.name.toLowerCase()));
    const missing = uniqueNames.filter((n) => !foundNames.has(n));
    if (missing.length) {
      throw new NotFoundException(`Tag(s) not found: ${missing.join(', ')}`);
    }
    return tags;
  }

  // Idempotently links a contact to the given tags within the transaction.
  // Concurrency: two requests for the same (contact, tag) would both pass an
  // in-memory existence check and double-insert. The migration
  // 1779950000000-add-contacts-tags-unique installs UNIQUE
  // (account_id, contact_id, tag_id); we rely on ON CONFLICT DO NOTHING and
  // trust RETURNING to surface only the rows that actually landed — that set
  // drives the publish, so a losing racer doesn't fire a duplicate event.
  private async attachTags(manager: EntityManager, accountId: number, contactId: number, tags: TagEntity[]): Promise<Array<{ contactId: number; tagId: number }>> {
    if (!tags.length) return [];
    const tagIds = tags.map((t) => t.id);
    const ctRepo = manager.getRepository(ContactTagEntity);

    const inserted = await ctRepo
      .createQueryBuilder()
      .insert()
      .into(ContactTagEntity)
      .values(tagIds.map((tagId) => ({ contactId, tagId, accountId })))
      .orIgnore()
      .returning(['tagId'])
      .execute();

    const insertedTagIds = (inserted.raw as Array<{ tag_id: number }>).map((r) => r.tag_id);
    return insertedTagIds.map((tagId) => ({ contactId, tagId }));
  }

  // Two body shapes flow in: `tagName: "x"` (Pet's integrations) and
  // `tagNames: [...]` (frontend). Merge to a single de-duplicated list so the
  // rest of the pipeline only has to think about one input.
  private mergeTagInputs(tagName?: string, tagNames?: string[]): string[] {
    const all = [...(tagNames ?? []), ...(tagName ? [tagName] : [])].map((n) => n?.trim()).filter((n): n is string => !!n);
    return [...new Set(all)];
  }

  // Resolves the inbound customFields map to existing custom_fields rows for
  // the account. Names are matched against custom_fields.name after applying
  // the same normalization @BeforeInsert uses on the column
  // (`replaceSpecialChars(title).toUpperCase()`), so callers can pass either
  // `utm_medium` or `UTM_MEDIUM` and hit the same row. Missing names -> 404
  // (no implicit creation, same policy as resolveTagsByName).
  //
  // contact_id is bound later in attachCustomFields — the resolve step runs
  // before the contact save so a 404 aborts the transaction without writing.
  private async resolveCustomFieldDefs(
    customFields: Record<string, string> | undefined,
    accountId: number,
    manager: EntityManager,
  ): Promise<Array<{ customFieldId: number; value: string }>> {
    if (!customFields || !Object.keys(customFields).length) return [];

    // Map normalized canonical name -> first (raw, value) pair the caller sent.
    // Duplicate keys with conflicting casing collapse to the first occurrence.
    const byCanonical = new Map<string, { rawKey: string; value: string }>();
    for (const [rawKey, value] of Object.entries(customFields)) {
      const canonical = (replaceSpecialChars(rawKey) ?? '').toUpperCase();
      if (!canonical) continue;
      if (!byCanonical.has(canonical)) byCanonical.set(canonical, { rawKey, value: value ?? '' });
    }
    if (!byCanonical.size) return [];

    const canonicalNames = [...byCanonical.keys()];
    const repo = manager.getRepository(CustomFieldsEntity);
    const defs = await repo.createQueryBuilder('cf').where('cf.account_id = :accountId', { accountId }).andWhere('cf.name IN (:...names)', { names: canonicalNames }).getMany();

    const defByName = new Map(defs.map((d) => [d.name, d]));
    const missing = canonicalNames
      .filter((c) => !defByName.has(c))
      // Report the raw (caller-provided) name so the error is grep-able.
      .map((c) => byCanonical.get(c)!.rawKey);
    if (missing.length) {
      throw new NotFoundException(`Custom field(s) not found: ${missing.join(', ')}`);
    }

    return canonicalNames.map((c) => ({
      customFieldId: defByName.get(c)!.id,
      value: String(byCanonical.get(c)!.value),
    }));
  }

  // Upserts the (contact, custom_field) rows. The unique constraint on
  // (account_id, contact_id, custom_field_id) — installed by
  // 1778883600000-add-contacts-custom-fields-unique — backs the ON CONFLICT.
  private async attachCustomFields(manager: EntityManager, accountId: number, contactId: number, defs: Array<{ customFieldId: number; value: string }>): Promise<void> {
    if (!defs.length) return;
    const rows = defs.map((d) => ({ accountId, contactId, customFieldId: d.customFieldId, value: d.value }));
    await manager.getRepository(ContactCustomFieldEntity).createQueryBuilder().insert().values(rows).orUpdate(['value'], ['account_id', 'contact_id', 'custom_field_id']).execute();
  }

  async update(contactDto: ContactDto, contactRepository: ContactEntity): Promise<ContactDto> {
    const accountId = this.cls.get<number>('accountId');
    if (!accountId) {
      throw new HttpException('Account context is required.', HttpStatus.BAD_REQUEST);
    }
    // Build a plain patch from the dto so the write doesn't trip on non-column
    // fields (fullName/maskedEmail set in @AfterLoad, tagNames, tagName,
    // customFields) or eager relations (contactTag, customFields,
    // contactAutomation, contactDevices) that ContactEntity carries when loaded.
    //
    // tagNames/customFields are *additive-only* on update: extra inputs link
    // new tags and upsert new/changed custom-field values; omitting them
    // leaves existing rows untouched. Clearing is out of scope for this
    // endpoint.
    const { id: _id, tagNames, tagName, customFields, ...patch } = contactDto;
    const mergedTagNames = this.mergeTagInputs(tagName, tagNames);
    try {
      const newPairs = await this.contactRepository.manager.transaction(async (manager) => {
        // Resolve first — a 404 here aborts the transaction before any write.
        const tags = await this.resolveTagsByName(mergedTagNames, accountId, manager);
        const cfDefs = await this.resolveCustomFieldDefs(customFields, accountId, manager);
        const contactRepo = manager.getRepository(ContactEntity);
        // Round-trip through create()+save() so @BeforeUpdate (setUserDetails)
        // fires and keeps email_provider/hashed_email in sync when email
        // changes. repository.update() bypasses entity listeners.
        const merged = contactRepo.create({ ...contactRepository, ...patch });
        await contactRepo.save(merged);
        await this.attachCustomFields(manager, accountId, contactRepository.id, cfDefs);
        return this.attachTags(manager, accountId, contactRepository.id, tags);
      });

      // Publish after commit, only for new pairs — never for a reverted write.
      if (newPairs.length) {
        await this.publishTagEvents('add', accountId, await this.buildTagEventPairs(accountId, newPairs));
      }
      // Cast: ContactEntity.customFields is the eager relation array, while
      // ContactDto.customFields is the inbound map — same name, different types.
      // The merged object never carries the relation through, so the cast is
      // safe.
      return { ...contactRepository, ...patch } as unknown as ContactDto;
    } catch (e) {
      if (e?.code === PostgresErrorCode.UniqueViolation) {
        throw new ConflictException('A contact with that email already exists in this account');
      }
      if (e instanceof HttpException) throw e;
      this.logger.error('Failed to update contact', e?.stack || e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Hard delete: is_active already means "deactivated" (different semantic);
  // FKs in contacts_devices/_tags/_automations/_custom_fields are CASCADE.
  async deleteOne(id: number): Promise<void> {
    const accountId = this.cls.get('accountId');
    const contact = await this.contactRepository.findOne({ where: { id, accountId } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    try {
      await this.contactRepository.delete({ id, accountId });
    } catch (e) {
      this.logger.error('Failed to delete contact', e?.stack || e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async bulkDelete(ids: number[]): Promise<{ deleted: number }> {
    const accountId = this.cls.get('accountId');
    if (!accountId) {
      throw new HttpException('Account context is required.', HttpStatus.BAD_REQUEST);
    }
    const uniqueIds = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueIds.length === 0) {
      throw new HttpException('No valid contact ids provided.', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.contactRepository.delete({ id: In(uniqueIds), accountId });
      return { deleted: result.affected ?? 0 };
    } catch (e) {
      this.logger.error('Failed to bulk delete contacts', e?.stack || e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(contactDto: ContactDto): Promise<ContactDto> {
    const accountId = this.cls.get<number>('accountId');
    if (!accountId) {
      throw new HttpException('Account context is required.', HttpStatus.BAD_REQUEST);
    }
    // tagName/tagNames/customFields are not columns on contacts — keep them
    // out of the contact write and route them through dedicated resolvers.
    const { tagNames, tagName, customFields, ...contactFields } = contactDto;
    const mergedTagNames = this.mergeTagInputs(tagName, tagNames);
    try {
      const { saved, newPairs } = await this.contactRepository.manager.transaction(async (manager) => {
        // Resolve tags and custom-field defs first — a 404 in either aborts
        // the transaction before the contact write lands.
        const tags = await this.resolveTagsByName(mergedTagNames, accountId, manager);
        const cfDefs = await this.resolveCustomFieldDefs(customFields, accountId, manager);

        const contactRepo = manager.getRepository(ContactEntity);
        // create() instantiates a ContactEntity so the @BeforeInsert
        // listener (setUserDetails) fires — a plain object literal would
        // bypass it, leaving email_provider/hashed_email unset.
        const contact = contactRepo.create({ ...contactFields, accountId });
        const saved = await contactRepo.save(contact);

        await this.attachCustomFields(manager, accountId, saved.id, cfDefs);
        const newPairs = await this.attachTags(manager, accountId, saved.id, tags);
        return { saved, newPairs };
      });

      // Publish after commit, only for new pairs — never for a reverted write.
      if (newPairs.length) {
        await this.publishTagEvents('add', accountId, await this.buildTagEventPairs(accountId, newPairs));
      }
      // Cast: see update() — ContactEntity.customFields is the eager relation.
      return saved as unknown as ContactDto;
    } catch (e) {
      // Preserve typed errors (e.g. NotFoundException from tag resolution)
      // instead of masking them as a generic 500.
      if (e instanceof HttpException) throw e;
      this.logger.error('Failed to create contact', e?.stack || e);
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

      // create() instantiates a ContactEntity so the @BeforeInsert /
      // @BeforeUpdate listener fires for both new and existing contacts.
      const contactEntity = this.contactRepository.create({
        ...(existingContact ?? { accountId, isActive: true, isValid: true }),
        ...contact,
        accountId,
      });
      const saved = await this.contactRepository.save(contactEntity);

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
        // Re-imports must not re-publish add-events for tags the contact already
        // carries: that would fire spurious add-trigger automations every run.
        const tagIdList = tagEntities.map((t: any) => t.id);
        const alreadyTagged = new Set(
          (
            await this.contactTagRepository
              .createQueryBuilder('ct')
              .select(['ct.tagId'])
              .where('ct.account_id = :accountId AND ct.contact_id = :contactId AND ct.tag_id IN (:...tagIds)', {
                accountId,
                contactId: saved.id,
                tagIds: tagIdList,
              })
              .getMany()
          ).map((row) => row.tagId),
        );
        const newTags = tagEntities.filter((t: any) => !alreadyTagged.has(t.id));
        if (newTags.length) {
          const tagRows = newTags.map((t: any) => ({ contactId: saved.id, tagId: t.id, accountId }));
          await this.contactTagRepository.createQueryBuilder().insert().values(tagRows).orIgnore().execute();
          await this.publishTagEvents(
            'add',
            accountId,
            newTags.map((t: any) => ({
              contact: { id: saved.id, email: saved.email, uuid: saved.uuid },
              tagName: t.name,
            })),
          );
        }
      }

      imported += 1;
    }

    return { imported };
  }

  async updateTag(params: { contacts: number[]; tags: number[]; action: 'add' | 'remove' }) {
    if (params.action !== 'add' && params.action !== 'remove') {
      throw new BadRequestException(`updateTag: unknown action "${params.action}"`);
    }
    const accountId = this.cls.get<number>('accountId');
    const contactIds: number[] = params.contacts ?? [];
    const tagIds: number[] = params.tags ?? [];
    if (!contactIds.length || !tagIds.length) {
      return { affected: 0 };
    }

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

    if (params.action === 'add') {
      // contacts_tags has no unique constraint on (account_id, contact_id, tag_id),
      // so .orIgnore() is a no-op — filter existing pairs in-memory before insert
      // to keep the relation idempotent.
      const values = contactIds.flatMap((contactId) => tagIds.filter((tagId) => !existingPairs.has(`${contactId}:${tagId}`)).map((tagId) => ({ contactId, tagId, accountId })));
      if (!values.length) {
        return { affected: 0 };
      }
      const result = await this.contactTagRepository.createQueryBuilder().insert().into('contacts_tags').values(values).execute();

      const newPairs = values.map(({ contactId, tagId }) => ({ contactId, tagId }));
      await this.publishTagEvents('add', accountId, await this.buildTagEventPairs(accountId, newPairs));

      return result;
    }

    // remove
    const result = await this.contactTagRepository
      .createQueryBuilder()
      .delete()
      .from('contacts_tags')
      .where('account_id = :accountId AND contact_id IN (:...contactIds) AND tag_id IN (:...tagIds)', {
        accountId,
        contactIds,
        tagIds,
      })
      .execute();

    // Only publish for pairs that actually existed (and therefore were deleted) —
    // publishing remove for a (contact, tag) the contact never had would fire
    // false remove-trigger automations downstream.
    const removedPairs = existing.map((row) => ({ contactId: row.contactId, tagId: row.tagId }));
    await this.publishTagEvents('remove', accountId, await this.buildTagEventPairs(accountId, removedPairs));

    return result;
  }

  private async buildTagEventPairs(
    accountId: number,
    pairs: Array<{ contactId: number; tagId: number }>,
  ): Promise<Array<{ contact: { id: number; email?: string; uuid?: string }; tagName: string }>> {
    if (!pairs.length) return [];
    const contactIds = Array.from(new Set(pairs.map((p) => p.contactId)));
    const tagIds = Array.from(new Set(pairs.map((p) => p.tagId)));

    const contacts = await this.contactRepository.find({ where: { id: In(contactIds), accountId }, select: ['id', 'email', 'uuid'] });
    const tags = await this.contactTagRepository.manager.getRepository(TagEntity).find({ where: { id: In(tagIds), accountId } });

    const contactById = new Map(contacts.map((c) => [c.id, c]));
    const tagById = new Map(tags.map((t) => [t.id, t]));

    const result: Array<{ contact: { id: number; email?: string; uuid?: string }; tagName: string }> = [];
    for (const { contactId, tagId } of pairs) {
      const tag = tagById.get(tagId);
      if (!tag?.name) {
        // Tag disappeared between the DB write and the lookup (deletion race or
        // bad input); skip but make it grep-able.
        this.logger.warn(`[buildTagEventPairs] no tag name for tagId=${tagId} account=${accountId}, skipping publish`);
        continue;
      }
      const contact = contactById.get(contactId);
      result.push({
        contact: { id: contactId, email: contact?.email, uuid: contact?.uuid },
        tagName: tag.name,
      });
    }
    return result;
  }

  async bulkUnsubscribe(params: { emails: string[]; allAccounts?: boolean; block?: boolean }) {
    const emails = [...params.emails];
    const date = new Date();
    if (!emails.length) {
      return;
    }

    // Suppression always scopes to the current account.
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

  async findContactHistory(id: number, params: ContactsPageDto): Promise<PaginationDto<any>> {
    try {
      const itemsPerPage = Number(params.itemsPerPage) || 10;
      const page = Number(params.page) || 1;
      // Automations (Postgres) and events (ClickHouse) are two independently
      // paginated sources merged into one timeline. To assemble a correct page of
      // the *merged* list we fetch enough rows from each to cover everything up to
      // the requested page, merge, sort by recency, then slice the page out.
      const fetchLimit = page * itemsPerPage;

      let automations: any[] = [];
      let automationsTotal = 0;
      let events: any[] = [];
      let eventsTotal = 0;

      const activities = ContactsService.toArray(params.activities);
      const shouldFetchAutomations = !activities.length || activities.includes('automation');
      const shouldFetchEvents = !activities.length || activities.includes('message');

      if (shouldFetchAutomations) {
        const buildAutomationsQuery = () => {
          const qb = this.contactAutomationRepository
            .createQueryBuilder('ca')
            .where('ca.account_id = :accountId', { accountId: this.cls.get('accountId') })
            .andWhere('ca.contact_id = :contactId', { contactId: id });

          if (params.startDate && params.endDate) {
            qb.andWhere('ca.created_at BETWEEN :startDate AND :endDate', {
              startDate: params.startDate,
              endDate: params.endDate,
            });
          }
          return qb;
        };

        automationsTotal = await buildAutomationsQuery().getCount();
        automations = await buildAutomationsQuery().select(['ca.*', "'automation' as type"]).orderBy('ca.created_at', 'DESC').limit(fetchLimit).getRawMany();
      }

      if (shouldFetchEvents) {
        const eventsResult = await this.fetchContactEventsFromClickhouse(id, params, activities, fetchLimit);
        events = eventsResult.events;
        eventsTotal = eventsResult.total;
      }

      // Merge both sources into a single timeline ordered by recency. Automation
      // rows carry `created_at`; ClickHouse event rows carry `time`.
      const combinedData = [...automations, ...events]
        .sort((a, b) => ContactsService.historyTimestamp(b) - ContactsService.historyTimestamp(a))
        .slice((page - 1) * itemsPerPage, page * itemsPerPage);

      return new PaginationDto<any>({
        results: combinedData,
        total: automationsTotal + eventsTotal,
        page,
        itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** Sortable epoch-ms for a history row, regardless of which source it came from. */
  private static historyTimestamp(item: any): number {
    const raw = item?.time ?? item?.created_at;
    const ts = raw ? new Date(raw).getTime() : NaN;
    return Number.isNaN(ts) ? 0 : ts;
  }

  /** Normalize a query-string param that may arrive as a single string or an array. */
  private static toArray(value: string | string[] | undefined): string[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  /**
   * ClickhHouse stores `DateTime64(3, 'UTC')` and the JSON driver renders it as
   * `YYYY-MM-DD HH:MM:SS.sss` with no offset. `new Date()` on the frontend would
   * read that as local time, so normalize it to an ISO-8601 UTC string here.
   */
  private static chTimeToIso(value: unknown): string | null {
    if (!value) return null;
    const s = String(value);
    const withT = s.includes('T') ? s : s.replace(' ', 'T');
    const withZ = /[Zz]$|[+-]\d\d:?\d\d$/.test(withT) ? withT : `${withT}Z`;
    const date = new Date(withZ);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  /**
   * Fetches message history for a contact from the ClickHouse
   * `events_logs_v2` table (the events do NOT live in Postgres — see EVO-1427).
   *
   * ClickHouse cannot join the Postgres `messages` table, so
   * titles and properties are hydrated in a second Postgres round-trip. Any
   * failure propagates to the caller's catch block: a missing data source must
   * surface as an error, not be masked as an empty history.
   *
   * Returns the most recent `limit` rows plus the overall match count, so the
   * caller can paginate the merged automations + events timeline correctly.
   */
  private async fetchContactEventsFromClickhouse(contactId: number, params: ContactsPageDto, activities: string[], limit: number): Promise<{ events: any[]; total: number }> {
    const accountId = Number(this.cls.get('accountId'));
    const safeContactId = Number(contactId);
    const safeLimit = Number(limit) || 10;

    // ClickHouse string literals treat backslash as an escape character, so both
    // backslashes and single quotes must be neutralized.
    const escape = (v: string) => v.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const where: string[] = [`account_id = ${accountId}`, `contact_id = ${safeContactId}`];

    if (params.startDate && params.endDate) {
      const start = dayjs(params.startDate);
      const end = dayjs(params.endDate);
      // Bound `time_date` (part of the table's ORDER BY key) so ClickHouse prunes
      // partitions, and `time` so the window matches the timestamp-precision
      // filter used by the automations branch in findContactHistory().
      where.push(`time_date BETWEEN '${escape(start.format('YYYY-MM-DD'))}' AND '${escape(end.format('YYYY-MM-DD'))}'`);
      where.push(`time BETWEEN '${escape(start.format('YYYY-MM-DD HH:mm:ss'))}' AND '${escape(end.format('YYYY-MM-DD HH:mm:ss'))}'`);
    }

    if (activities.length && activities.includes('message')) {
      where.push("message_type != 'custom_events'");
    }

    const channels = ContactsService.toArray(params.channels);
    if (channels.length) {
      const mapped = channels.map((channel) => {
        switch (channel) {
          case 'wpp':
            return 'whatsapp';
          default:
            return channel;
        }
      });
      where.push(`message_type IN (${mapped.map((c) => `'${escape(c)}'`).join(', ')})`);
    }

    const whereSql = where.join(' AND ');
    // Project only the columns the history endpoint needs — avoids leaking
    // internal/PII columns (`email`, `ip`, `uuid`, `user_agent`, `properties`…).
    const columns = 'time, message_type, event, message_id, event_id, contact_id, automation_id, campaign_id';

    const countRows = await this.clickhouseProvider.runQuery(`SELECT count() AS total FROM events_logs_v2 WHERE ${whereSql}`);
    const total = Number(countRows[0]?.total) || 0;
    if (!total) {
      return { events: [], total: 0 };
    }

    const rows = await this.clickhouseProvider.runQuery(`
      SELECT ${columns}
      FROM events_logs_v2
      WHERE ${whereSql}
      ORDER BY time DESC
      LIMIT ${safeLimit}
    `);
    if (!rows.length) {
      return { events: [], total };
    }

    // Hydrate message titles from Postgres (cross-DB join).
    const messageIds = [...new Set(rows.filter((r) => Number(r.message_id) > 0).map((r) => Number(r.message_id)))];

    const messagesById = new Map<number, { title: string; type: string }>();
    if (messageIds.length) {
      const messageRows = await this.contactRepository.manager.query('SELECT id, title, type FROM messages WHERE id = ANY($1)', [messageIds]);
      for (const m of messageRows) {
        messagesById.set(Number(m.id), { title: m.title, type: m.type });
      }
    }

    const events = rows.map((row) => {
      const message = messagesById.get(Number(row.message_id));

      return {
        ...row,
        time: ContactsService.chTimeToIso(row.time) ?? row.time,
        message_title: message?.title ?? null,
        type: 'message',
        // ClickHouse defaults `message_type` to '' (the old Postgres column was
        // nullable); when blank, fall back to the message's own type.
        message_type: !row.message_type && message?.type ? message.type : row.message_type,
      };
    });

    return { events, total };
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
  async deactivateInactiveContacts() {
    try {
      // Opt-in: pre-OSS this job ran only on internal accounts (effectively a
      // no-op for most installs). Now scoped to all accounts, but gated so
      // upgrades don't silently sweep production data on first cron tick.
      if (process.env.DEACTIVATE_INACTIVE_CONTACTS_ENABLED !== 'true') {
        return;
      }
      const accounts = await this.accountsService.getAllAccounts();
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
