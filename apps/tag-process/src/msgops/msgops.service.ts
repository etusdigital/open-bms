import { Injectable } from '@nestjs/common';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AutomationEntity } from './entities/automation.entity';
import { ContactAutomationEntity } from './entities/contact-automation.entity';
import { ContactEntity } from './entities/contact.entity';
import { ContactTagEntity } from './entities/contact-tag.entity';
import { TagEntity } from './entities/tag.entity';
import { Repository, In, UpdateResult, EntityManager, ILike } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from 'src/providers/redis/redis.service';
import { ContactEditableAttributes, CustomFieldKeyType, SegmentExternalQueryPayload, Status } from '../interfaces';
import { LeadsEntity } from './entities/leads.entity';
import { AccountEntity } from './entities/account.entity';
import { ContactConditionalEntity } from './entities/contact-conditional.entity';
import { TrackerService } from 'src/tracker/tracker.service';
import { AutomationTargetEntity } from './entities/automation-target-entity';
import { CampaignEntity } from './entities/campaign.entity';
import { ClickhouseProvider } from 'src/providers/clickhouse.provider';

@Injectable()
export class MsgopsService {
  constructor(
    @InjectRepository(ContactEntity)
    private readonly contactRepository: Repository<ContactEntity>,
    @InjectRepository(ContactConditionalEntity)
    private readonly contactConditionalRepository: Repository<ContactConditionalEntity>,
    @InjectRepository(AutomationEntity)
    private readonly automationRepository: Repository<AutomationEntity>,
    @InjectRepository(ContactAutomationEntity)
    private readonly contactAutomationRepository: Repository<ContactAutomationEntity>,
    @InjectRepository(ContactTagEntity)
    private readonly contactTagRepository: Repository<ContactTagEntity>,
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,
    @InjectRepository(LeadsEntity)
    private readonly leadRepository: Repository<LeadsEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(AutomationTargetEntity)
    private readonly automationTargetRepository: Repository<AutomationTargetEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    private readonly redisService: RedisService,
    private readonly entityManager: EntityManager,
    private readonly trackerService: TrackerService,
    private readonly clickhouseProvider: ClickhouseProvider,
  ) {}

  async findAccountByConfig(name: string, value: string) {
    return await this.accountConfigRepository.findOne({
      join: {
        alias: 'accounts_configs',
        leftJoinAndSelect: {
          account: 'accounts_configs.account',
        },
      },
      where: {
        name,
        value,
      },
    });
  }

  async findAccount(accountId: number) {
    const redisClient = await this.redisService.getOrThrow();
    const redisKey = `account:${accountId}`;
    const accountCache: AccountEntity = await redisClient.get(redisKey).then((account) => {
      if (account) {
        return JSON.parse(account);
      }
    });
    if (accountCache) return accountCache;

    const account = await this.accountRepository.findOne({
      where: { id: accountId },
    });

    await redisClient.set(redisKey, JSON.stringify(account));

    return account;
  }

  async findContactByEmail(email: string, accountId = 0) {
    return await this.contactRepository.findOne({
      where: {
        email,
        accountId,
      },
    });
  }

  async findContactByUuid(uuid: string, accountId = 0) {
    return await this.contactRepository
      .createQueryBuilder('contacts')
      .where('uuid = :uuid', { uuid })
      .andWhere('account_id = :accountId', { accountId })
      .select(['id', 'email'])
      .getRawOne();
  }

  async findContactById(id: number, accountId = 0): Promise<ContactEntity> {
    const result = await this.contactRepository.query(`
            WITH contacttags AS
        (
                  SELECT    contact_id,
                            Array_agg((tg.NAME)) AS tags
                  FROM contacts_tags ctg
                  LEFT JOIN tags tg ON tg.id = ctg.tag_id
                  WHERE ctg.contact_id = ${id} AND ctg.account_id = ${accountId}
                  GROUP BY  contact_id ), contactscustomfields AS
        (
                  SELECT    contact_id,
                            jsonb_agg(jsonb_build_object('name', cf.NAME, 'value', ccf.value, 'customFieldId', cf.id)) AS custom_fields
                  FROM contacts_custom_fields ccf
                  LEFT JOIN custom_fields cf ON cf.id = ccf.custom_field_id
                  WHERE ccf.contact_id = ${id} AND ccf.account_id = ${accountId}
                  GROUP BY  contact_id ), contactsdevices AS
        (
                SELECT   contact_id,
                          jsonb_agg(jsonb_build_object('id', id, 'accountId', account_id, 'contactId', contact_id , 'isActive', is_active 
                          , 'type', type, 'token', token, 'isUnsubscribed', is_unsubscribed, 'ip', ip, 'deviceType', device_type , 'os', os
                          , 'browser', browser, 'browserVersion', browser_version, 'resolution', resolution, 'subscriptionUrl', subscription_url 
                          , 'latestVisitedUrl', latest_visited_url, 'lastSession', last_session, 'lastSent', last_sent , 'lastSentDate', last_sent_date 
                          , 'lastView', last_view, 'lastViewDate', last_view_date , 'lastClick', last_click, 'lastClickDate', last_click_date
                          , 'createdAt', created_at, 'updatedAt', updated_at )) AS contact_devices
                FROM contacts_devices
                WHERE contact_id = ${id} AND account_id = ${accountId}
                GROUP BY contact_id )
        SELECT    ct.*,
                  contacttags.tags,
                  contactscustomfields.custom_fields,
                  contactsdevices.contact_devices
        FROM contacts ct
        LEFT JOIN contacttags ON contacttags.contact_id = ct.id
        LEFT JOIN contactscustomfields ON contactscustomfields.contact_id = ct.id
        LEFT JOIN contactsdevices ON contactsdevices.contact_id = ct.id
        WHERE ct.id = ${id} AND ct.account_id = ${accountId}
    `);
    if (!result.length) {
      return;
    }
    const returnObject: any = {};
    Object.keys(result[0]).forEach((key) => {
      returnObject[this.snakeToCamelCase(key)] = result[0][key];
      if (key === 'custom_fields') {
        const keyValueObject = {};
        for (const customField of returnObject.customFields || []) {
          keyValueObject[`${customField.name}`] = customField.value;
        }
        returnObject.customFields = keyValueObject;
      }
    });
    returnObject.fullName = `${returnObject.firstName} ${returnObject.lastName || ''}`.trim();
    returnObject.contactDevices = returnObject.contactDevices || [];
    return returnObject;
  }

  async findContactsUUID(contacts, accountId) {
    return await this.contactRepository
      .createQueryBuilder('contacts')
      .where('contacts.account_id = :accountId', { accountId })
      .andWhere('contacts.id IN (:...contacts)', { contacts })
      .select(['id', 'uuid', 'email'])
      .getRawMany();
  }

  snakeToCamelCase(key) {
    return key.replace(/(_\w)/g, (value) => value[1].toUpperCase());
  }

  async getAutomationsByTag(tagId: number, accountId: number): Promise<AutomationEntity[]> {
    const redisClient = await this.redisService.getOrThrow();
    const redisKey = `automations_tag:${accountId}:${tagId}`;
    const automationsCache: AutomationEntity[] = await redisClient
      .get(redisKey)
      .then((automation) => JSON.parse(automation));
    if (automationsCache) return automationsCache;

    const automations = await this.automationRepository
      .createQueryBuilder('automations')
      .innerJoinAndSelect('automations.account', 'account')
      .leftJoinAndSelect('account.accountConfigs', 'accountConfigs')
      .leftJoinAndSelect('account.customFields', 'customFields')
      .where('automations.account_id = :accountId', { accountId })
      .andWhere('automations.active = :active', { active: true })
      .andWhere(`(automations.triggers->'settings'->>'id')::int = :tagId`, { tagId })
      .andWhere('accountConfigs.is_load_config = true')
      .getMany();

    await redisClient.set(redisKey, JSON.stringify(automations));

    return automations;
  }

  async getAutomationsByPush(accountId: number, type: string): Promise<AutomationEntity[]> {
    const redisClient = await this.redisService.getOrThrow();
    const redisKey = `automations_push:${accountId}`;
    const automationsCache: AutomationEntity[] = await redisClient
      .get(redisKey)
      .then((automation) => JSON.parse(automation));
    if (automationsCache) return automationsCache;

    const automations = await this.automationRepository
      .createQueryBuilder('automations')
      .innerJoinAndSelect('automations.account', 'account')
      .leftJoinAndSelect('account.accountConfigs', 'accountConfigs')
      .leftJoinAndSelect('account.customFields', 'customFields')
      .where('automations.account_id = :accountId', { accountId })
      .andWhere('automations.active = :active', { active: true })
      .andWhere(`(automations.triggers->'settings'->>'type')::text = '${type}'`)
      .andWhere('accountConfigs.is_load_config = true')
      .getMany();

    await redisClient.set(redisKey, JSON.stringify(automations));

    return automations;
  }

  async getAutomationsByEvent(
    accountId: number,
    eventType: 'open' | 'click' | 'custom_events' | 'first_open_30_days',
    messageId: number,
  ): Promise<AutomationEntity[]> {
    const redisClient = await this.redisService.getOrThrow();
    const redisKey = `events_trigger:${accountId}:${eventType}:${messageId}:automations`;
    this.trackerService.logInfo(`[events_trigger] ${redisKey}`);
    const automationsCache: AutomationEntity[] = await redisClient
      .get(redisKey)
      .then((automation) => JSON.parse(automation));
    if (automationsCache) return automationsCache;

    const query = await this.automationRepository
      .createQueryBuilder('automations')
      .innerJoinAndSelect('automations.account', 'account')
      .leftJoinAndSelect('account.accountConfigs', 'accountConfigs')
      .leftJoinAndSelect('account.customFields', 'customFields')
      .where('automations.account_id = :accountId', { accountId })
      .andWhere('automations.active = :active', { active: true })
      .andWhere('accountConfigs.is_load_config = true');

    if (eventType === 'custom_events') {
      query.andWhere(
        `automations.triggers->'settings'->>'type' = 'custom_events' and (automations.triggers->'settings'->>'id')::int = :messageId`,
        { eventType, messageId },
      );
    }

    if (eventType !== 'custom_events') {
      query.andWhere(
        `automations.triggers->'settings'->>'type' = 'events' and automations.triggers->'settings'->>'eventType' = :eventType and (automations.triggers->'settings'->>'id')::int = :messageId`,
        { eventType, messageId },
      );
    }

    const automations = await query.getMany();

    await redisClient.set(redisKey, JSON.stringify(automations));

    return automations;
  }

  async getCampaignsByEvent(
    accountId: number,
    eventType: 'open' | 'click' | 'custom_events' | 'first_open_30_days',
    messageId: number,
  ): Promise<AutomationEntity[]> {
    const redisClient = await this.redisService.getOrThrow();
    const redisKey = `events_trigger:${accountId}:${eventType}:${messageId}:campaigns`;
    this.trackerService.logInfo(`[events_trigger] ${redisKey}`);
    const typeFilter = eventType === 'custom_events' ? 'type' : 'eventType';
    const campaignsCache: AutomationEntity[] = await redisClient
      .get(redisKey)
      .then((campaigns) => JSON.parse(campaigns));
    if (campaignsCache) return campaignsCache;

    const query = this.campaignRepository
      .createQueryBuilder('campaigns')
      .innerJoinAndSelect('campaigns.account', 'account')
      .leftJoinAndSelect('account.accountConfigs', 'accountConfigs')
      .leftJoinAndSelect('account.customFields', 'customFields')
      .where('campaigns.account_id = :accountId', { accountId })
      .andWhere(`campaigns.triggers->'settings'->>'${typeFilter}' = :eventType`, { eventType })
      .andWhere(`campaigns.triggers->'settings'->>'id' = :messageId`, { messageId });

    const campaigns = await query.getMany();
    const campaignsConverted = campaigns.map((campaign) => {
      return {
        id: campaign.id,
        title: campaign.title,
        name: campaign.name,
        account: campaign.account,
        type: 'campaign',
        steps: campaign.steps,
        triggers: campaign.triggers,
        isActive: true,
        verticalType: 'campaign',
        isRateLimit: campaign.isRateLimit,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      } as AutomationEntity;
    });

    if (campaignsConverted.length) {
      await redisClient.set(redisKey, JSON.stringify(campaignsConverted));
    }

    return campaignsConverted;
  }

  async getTagByName(name: string, accountId: number) {
    name = name.toLowerCase();
    const redisClient = await this.redisService.getOrThrow();
    const redisKey = `tag:${name}:${accountId}`;
    const tagCache: TagEntity = await redisClient.get(redisKey).then((tag) => JSON.parse(tag));
    if (tagCache) return tagCache;

    const tag = await this.tagRepository.findOne({
      where: {
        name: ILike(name),
        accountId,
      },
    });

    await redisClient.set(redisKey, JSON.stringify(tag));

    return tag;
  }

  async createContactAutomations(newContactAutomation) {
    return this.contactAutomationRepository
      .createQueryBuilder('contact_automation')
      .insert()
      .values(newContactAutomation)
      .orIgnore(true)
      .execute();
  }

  async queryEventsLogs(query: string) {
    return await this.clickhouseProvider.runQuery(query);
  }

  async updateContactAutomations(contactAutomation, newContactAutomation, leadMessage) {
    this.contactAutomationRepository.merge(contactAutomation, newContactAutomation);

    await this.contactAutomationRepository
      .createQueryBuilder('contact_automation')
      .update()
      .set(contactAutomation)
      .where('account_id = :accountId AND id = :id', {
        accountId: contactAutomation.accountId,
        id: contactAutomation.id,
      })
      .execute();

    if (contactAutomation.status == Status.canceled) {
      const redisClient = await this.redisService.getOrThrow();
      const expireIn2Days = 60 * 60 * 48;
      await redisClient.set(`automation_to_stop:${leadMessage.id}`, 'true', 'EX', expireIn2Days);
    }
  }

  async completeAutomations(accountId: number, id: number) {
    return this.contactAutomationRepository
      .createQueryBuilder('contact_automation')
      .update()
      .set({
        status: Status.completed,
      })
      .where('account_id = :accountId AND id = :id', {
        id,
        accountId,
        status: Status.running,
      })
      .execute();
  }

  async getContactAutomations(contactId: number, automationId: number, accountId: number, status: string[]) {
    return await this.contactAutomationRepository.findOne({
      where: {
        contactId,
        automationId,
        accountId,
        status: In(status),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllContactAutomations(contactId: number, automationId: number, accountId: number, status: string[]) {
    return await this.contactAutomationRepository.find({
      where: {
        contactId,
        automationId,
        accountId,
        status: In(status),
      },
    });
  }

  async getFirstContactAutomations(contactId: number, automationId: number, accountId: number) {
    return await this.contactAutomationRepository.findOne({
      where: {
        contactId,
        automationId,
        accountId,
      },
    });
  }

  async deleteContactTag(contactId: number, tagId: number, accountId: number) {
    return await this.contactTagRepository.delete({ contactId, tagId, accountId });
  }

  async createContactTag(contactId: number, tagId: number, accountId: number) {
    const contactTag = this.contactTagRepository.create({ contactId, tagId, accountId });
    return this.contactTagRepository.save(contactTag);
  }

  async findContactsByEmail(emails: string[], accountId = 0) {
    const emailsInLowerCase = emails.map((email) => email.toLowerCase());
    return await this.contactRepository.find({
      where: {
        email: In(emailsInLowerCase),
        accountId,
      },
      select: ['id', 'email'],
    });
  }

  async deleteContactTagBatch(contacts: number[], tagId: number, accountId: number) {
    return await this.contactTagRepository
      .createQueryBuilder('contact_tag')
      .where('account_id = :accountId AND tag_id = :tagId AND contact_id IN (:...contacts)', {
        accountId,
        tagId,
        contacts,
      })
      .delete()
      .execute();
  }

  async createContactTagBatch(contactsTag) {
    try {
      return await this.contactTagRepository
        .createQueryBuilder('contact_tag')
        .insert()
        .values(contactsTag)
        .orIgnore(true)
        .execute();
    } catch (e) {
      console.error(e);
      return true;
    }
  }

  async createContactsBatch(contacts) {
    try {
      return await this.contactRepository
        .createQueryBuilder('contact')
        .insert()
        .values(contacts)
        .returning('id')
        .orIgnore(true)
        .execute();
    } catch (e) {
      console.error(e);
      return true;
    }
  }

  async getTagById(id: number) {
    return await this.tagRepository.findOne({
      where: { id },
    });
  }

  async queryRunner(query: string) {
    return await this.entityManager.query(query);
  }

  async processSegment(
    tagId: number,
    accountId: number,
    query: string,
    externalQueries: Array<SegmentExternalQueryPayload> | null,
  ): Promise<{ insertIds; deleteIds }> {
    const queryRunner = this.contactTagRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let insertIds = null;
    let deleteIds = null;

    try {
      if (!query) {
        await queryRunner.manager.delete(ContactTagEntity, { tagId, accountId });
      } else {
        if (externalQueries) {
          for (const externalQuery of externalQueries) {
            const tableFilter = externalQuery.filterType === 'email' ? 'email' : 'contact_id';
            queryRunner.manager.query(
              `CREATE TEMP TABLE ${externalQuery.tableName} (${tableFilter} ${tableFilter == 'email' ? 'VARCHAR(500)' : 'INT'});`,
            );
            const clickhouseEvents = await this.clickhouseProvider.runQuery(externalQuery.query);
            const batchSize = 5000;
            const batches = [];

            for (let i = 0; i < clickhouseEvents.length; i += batchSize) {
              batches.push(clickhouseEvents.slice(i, i + batchSize));
            }

            for (const batch of batches) {
              const contactIds = batch.map((c) => c[tableFilter]);
              const params = [contactIds];

              await queryRunner.manager.query(
                `INSERT INTO ${externalQuery.tableName} (${tableFilter})
                 SELECT * FROM UNNEST($1::${tableFilter == 'email' ? 'varchar' : 'int'}[]);`,
                params,
              );
            }
          }
        }

        await queryRunner.manager.query(query);
        const insertQuery = `INSERT INTO contacts_tags (
            SELECT contact_id, ${tagId}, ${accountId} FROM segment_process
            WHERE tag_id = ${tagId} AND contact_id NOT IN ( SELECT contact_id FROM contacts_tags 
              WHERE tag_id = ${tagId} AND account_id = ${accountId}
            )
          ) RETURNING contact_id;`;

        const deleteQuery = `DELETE FROM contacts_tags WHERE
          account_id = ${accountId} AND tag_id = ${tagId} AND contact_id  NOT IN (
            select contact_id from segment_process WHERE tag_id = ${tagId}
          )
          RETURNING contact_id;`;

        deleteIds = (await queryRunner.manager.query(deleteQuery))[0];
        insertIds = await queryRunner.manager.query(insertQuery);
        await queryRunner.manager.query(`DELETE FROM segment_process WHERE tag_id = ${tagId}`);
      }
      await queryRunner.commitTransaction();
      return { deleteIds, insertIds };
    } catch (_err) {
      await queryRunner.rollbackTransaction();
      throw new Error(`[Segment] Error executing segment: ${tagId}`);
    } finally {
      await queryRunner.release();
      return { deleteIds, insertIds };
    }
  }

  async updateTag(tagId: number, changes: any) {
    return await this.tagRepository.update(tagId, changes);
  }

  async updateContact(contact: ContactEntity, changes: ContactEditableAttributes): Promise<UpdateResult> {
    try {
      return await this.contactRepository
        .createQueryBuilder()
        .update()
        .set(changes)
        .where('id = :id', { id: contact.id })
        .andWhere('account_id = :accountId', { accountId: contact.accountId })
        .execute();
    } catch (e) {
      console.error(e);
      return;
    }
  }

  async getNumberContactsByTag(
    accountId: number,
    id: number,
  ): Promise<{
    total: number;
    email: number;
    mobile_push: number;
    web_push: number;
    phone: number;
    whatsapp: number;
  }> {
    const count = await this.contactTagRepository
      .createQueryBuilder('contacts_tags')
      .leftJoin('contacts', 'c', 'c.id = contacts_tags.contact_id AND c.account_id = contacts_tags.account_id')
      .select([
        'COUNT(DISTINCT contacts_tags.contact_id) AS total',
        'SUM(CASE WHEN c.has_email AND c.is_valid AND NOT c.is_unsubscribed AND NOT c.has_bounced THEN 1 ELSE 0 END) AS email',
        'SUM(CASE WHEN c.has_mobile_push THEN 1 ELSE 0 END) AS mobile_push',
        'SUM(CASE WHEN c.has_web_push THEN 1 ELSE 0 END) AS web_push',
        'SUM(CASE WHEN c.has_phone THEN 1 ELSE 0 END) AS phone',
        'SUM(CASE WHEN c.has_whatsapp THEN 1 ELSE 0 END) AS whatsapp',
      ])
      .where('contacts_tags.account_id = :accountId AND contacts_tags.tag_id = :id', { accountId, id })
      .getRawOne();

    return count || { total: 0, email: 0, mobile_push: 0, web_push: 0, phone: 0, whatsapp: 0 };
  }

  async updateLead(
    leadId: number,
    changes: { automationId: number; automationTitle: string; automationStatus: string },
  ): Promise<UpdateResult> {
    if (!leadId) {
      return;
    }

    return await this.leadRepository
      .createQueryBuilder()
      .update()
      .set({ ...changes, updatedAt: new Date() })
      .where('id = :id', { id: leadId })
      .execute();
  }

  async findContactByIdConditional(id: number, accountId: number, loadContacts, keyType?: CustomFieldKeyType) {
    const getContacts = this.contactConditionalRepository
      .createQueryBuilder('contact')
      .where('contact.id = :id AND contact.account_id = :accountId', { id, accountId });

    for (const load of loadContacts) {
      getContacts.leftJoinAndSelect(`contact.${load}`, `${load}`);
      if (load === 'customFields') {
        getContacts.leftJoinAndSelect('customFields.customFieldType', 'customFieldType');
      }
    }

    const contact = await getContacts.getOne();
    contact.parseCustomFields(keyType || CustomFieldKeyType.ID);

    return contact;
  }

  async findLeadById(leadId: number) {
    return await this.leadRepository.findOne({ where: { id: leadId } });
  }

  async completeTargetedAutomations(
    currentDate: string,
    data: { accountId: number; automationId: number; contactId: number },
  ) {
    const incrTargetedAutomationQuery = `
    INSERT INTO automations_targets (date, account_id, automation_id, count)
    VALUES ('${currentDate}', ${data.accountId}, ${data.automationId}, 1)
    ON CONFLICT (date, account_id, automation_id) DO UPDATE 
    SET count = automations_targets.count + 1;`;

    const runningAutomations = await this.getAllContactAutomations(data.contactId, data.automationId, data.accountId, [
      'running',
    ]);
    if (runningAutomations.length) {
      await this.queryRunner(incrTargetedAutomationQuery);
      const tag = await this.getTagByName('usuario-no-fluxo', data.accountId);
      if (tag) {
        await this.deleteContactTag(data.contactId, tag.id, data.accountId);
      }
      for (const automation of runningAutomations) {
        await this.contactAutomationRepository
          .createQueryBuilder()
          .update()
          .set({ status: Status.completed })
          .where('id = :id AND account_id = :accountId', { id: automation.id, accountId: data.accountId })
          .execute();
      }
      return runningAutomations;
    }
    return [];
  }

  async createSegmentTable(segmentId: number, batches: any, concatTableName: string) {
    const queryRunner = this.contactTagRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tableName = `segment_${segmentId}_${concatTableName}_${Date.now()}`;
      const createQuery = `create temp table ${tableName} (contact_id INT)`;
      await queryRunner.manager.query(createQuery);
      for (const batch of batches) {
        let insertQuery = ``;
        for (const contact of batch) {
          insertQuery += `
            INSERT INTO ${tableName} values (${contact});`;
        }
        await queryRunner.manager.query(insertQuery);
      }

      await queryRunner.commitTransaction();
      return tableName;
    } catch (_err) {
      await queryRunner.rollbackTransaction();
      throw new Error(`[CLICKHOUSE] Error executing segment`);
    } finally {
      await queryRunner.release();
    }
  }

  async processSegmentOutLogic(
    intervalClick: number,
    intervalOpen: number,
    accountId: number,
    segmentId: number,
    table: string,
    tagIdRule: number,
    accountTimeZone: string,
  ) {
    const queryRunner = this.contactTagRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    try {
      const dataQuery = `
      with in_tag_table as (
        select distinct contact_id from contacts_tags where account_id = ${accountId} and tag_id IN (${tagIdRule})
        and contact_id IN (select contact_id from ${table})
      ) select
      b.id,
      b.uuid,
      b.is_unsubscribed as unsub,
      case when is_valid then false else true end as invalid,
      case when d.email is not null then true else false end as is_suppression,
      has_bounced as bounced,
      case when last_open_date > (CURRENT_DATE AT TIME ZONE '${accountTimeZone}' - interval '${intervalOpen} day') then false else true end open,
      case when last_click_date > (CURRENT_DATE AT TIME ZONE '${accountTimeZone}' - interval '${intervalClick} day') then false else true end click,
      case when c.contact_id is not null then true else false end in_tag
      from ${table} a
      inner join contacts b on b.id = a.contact_id and b.account_id = ${accountId}
      left join in_tag_table c on a.contact_id = c.contact_id 
      left join suppressions d on b.email = d.email and d.unsubscribed_at > (CURRENT_DATE AT TIME ZONE '${accountTimeZone}' - interval '${intervalOpen} day')
      where b.account_id = ${accountId}`;

      const data = await queryRunner.manager.query(dataQuery);

      await queryRunner.manager.query(`DROP TABLE ${table}`);

      return data;
    } catch (_err) {
      await queryRunner.manager.query(`DROP TABLE ${table}`);
      throw new Error(`[CLICKHOUSE] Error executing segment`);
    } finally {
      await queryRunner.release();
    }
  }

  async processSegmentInLogic(accountId: number, table: string, last3Days: string) {
    const queryRunner = this.contactTagRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    try {
      const dataQuery = `
      with in_lead_table as (
        select distinct contact_id from leads where account_id = ${accountId} and created_at_date >= '${last3Days}'
        and contact_id IN (select contact_id from ${table})
      ) select
      b.id,
      b.uuid,
      case when c.contact_id is not null then true else false end bought,
      case when c.contact_id is null then true else false end reengaged
      from ${table} a
      inner join contacts b on b.id = a.contact_id and b.account_id = ${accountId}
      left join in_lead_table c on a.contact_id = c.contact_id 
      where b.account_id = ${accountId}`;

      const data = await queryRunner.manager.query(dataQuery);

      await queryRunner.manager.query(`DROP TABLE ${table}`);
      return data;
    } catch (_err) {
      await queryRunner.manager.query(`DROP TABLE ${table}`);
      throw new Error(`[CLICKHOUSE] Error executing segment`);
    } finally {
      await queryRunner.release();
    }
  }
}
