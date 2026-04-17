import { Injectable } from '@nestjs/common';
import { ContactEntity } from './entities/contact.entity';
import { AccountEntity } from './entities/account.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AccountApiKeyEntity } from './entities/account-api-key.entity';
import { CustomFieldsEntity } from './entities/custom-fields.entity';
import { Repository, In, IsNull, MoreThan, DataSource, EntityManager } from 'typeorm';
import { ContactCustomFieldEntity } from './entities/contact-custom-field.entity';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Contact, ContactDevice, EventLogResubscribed, Lead } from 'src/interfaces';
import { ContactDeviceEntity } from './entities/contact-device.entity';
import { RedisService } from '../providers/redis/redis.service';
import { LeadsEntity } from './entities/leads.entity';
import { SuppressionEntity } from './entities/suppression.entity';
import { ClusterMessageEntity } from './entities/cluster_message.entity';
import { ContactTagEntity } from './entities/contact-tag.entity';
import { createHash } from 'crypto';

@Injectable()
export class MsgopsService {
  constructor(
    @InjectRepository(ContactEntity)
    private readonly contactRepository: Repository<ContactEntity>,

    @InjectRepository(SuppressionEntity)
    private readonly suppressionRepository: Repository<SuppressionEntity>,

    @InjectRepository(CustomFieldsEntity)
    private readonly customFieldsRepository: Repository<CustomFieldsEntity>,

    @InjectRepository(ContactCustomFieldEntity)
    private readonly contactCustomFieldsRepository: Repository<ContactCustomFieldEntity>,

    @InjectRepository(ContactDeviceEntity)
    private readonly contactDevicesRepository: Repository<ContactDeviceEntity>,

    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,

    @InjectRepository(AccountApiKeyEntity)
    private readonly accountApiKeyRepository: Repository<AccountApiKeyEntity>,

    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,

    @InjectRepository(LeadsEntity)
    private readonly leadsRepository: Repository<LeadsEntity>,

    @InjectRepository(ClusterMessageEntity)
    private readonly clusterMessageRepository: Repository<ClusterMessageEntity>,

    @InjectRepository(ContactTagEntity)
    private readonly contactTagRepository: Repository<ContactTagEntity>,

    private readonly redisService: RedisService,
    private entityManager: EntityManager,

    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  private hashApiKey(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  async findAccountByApiKey(apiKey: string): Promise<AccountEntity | undefined> {
    const redisClient = this.redisService.getOrThrow();
    const apiKeyEncripted = Buffer.from(apiKey).toString('base64');
    const redisKey = `account:${apiKeyEncripted}`;
    const accountCache: AccountEntity = await redisClient.get(redisKey).then((account) => {
      if (account) {
        return JSON.parse(account);
      }
    });
    if (accountCache) return accountCache;

    // 1. Try managed keys table first (accounts_api_keys)
    const keyHash = this.hashApiKey(apiKey);
    const now = new Date();
    const managedKey = await this.accountApiKeyRepository.findOne({
      where: [
        { keyHash, status: 'active', revokedAt: IsNull(), expiresAt: IsNull() },
        { keyHash, status: 'active', revokedAt: IsNull(), expiresAt: MoreThan(now) },
      ],
    });

    if (managedKey) {
      const account = await this.accountRepository.findOneBy({ id: managedKey.accountId });
      if (account) {
        await redisClient.set(redisKey, JSON.stringify(account));
        return account;
      }
    }

    // 2. Fallback to legacy accounts_configs
    const accountConfig = await this.accountConfigRepository.findOne({
      join: {
        alias: 'accounts_configs',
        leftJoinAndSelect: {
          account: 'accounts_configs.account',
        },
      },
      where: [
        { name: 'api_key', value: apiKey },
        { name: 'api_key_tracker', value: apiKey },
      ],
    });

    if (!accountConfig) {
      return undefined;
    }

    const account = await this.accountRepository.findOneBy({ id: accountConfig.accountId });

    if (account) {
      await redisClient.set(redisKey, JSON.stringify(account));
    }

    return account;
  }

  async findContactByEmail(email: string, accountId: number): Promise<ContactEntity> {
    return await this.contactRepository.findOne({
      where: {
        email,
        accountId,
      },
    });
  }

  async findSuppressionByEmail(email: string, groupId: number): Promise<SuppressionEntity> {
    return await this.suppressionRepository.findOne({
      where: {
        email,
        groupId,
      },
    });
  }

  async findContactByUuid(uuid: string, accountId: number): Promise<ContactEntity> {
    return await this.contactRepository.findOne({
      where: {
        uuid,
        accountId,
      },
    });
  }

  async findContactById(id: number, accountId: number): Promise<ContactEntity> {
    return await this.contactRepository.findOne({
      where: {
        id,
        accountId,
      },
    });
  }

  async findContactByDevice(tokens, accountId: number): Promise<ContactEntity | undefined> {
    const contactDevice = await this.contactDevicesRepository.findOne({
      join: {
        alias: 'contacts_devices',
        leftJoinAndSelect: {
          contact: 'contacts_devices.contact',
        },
      },
      where: {
        token: In(tokens),
        accountId,
      },
    });

    if (!contactDevice) {
      return undefined;
    }

    return contactDevice.contact;
  }

  async deleteContact(id: number, accountId: number) {
    await this.contactDevicesRepository.delete({ contactId: id, accountId });
    return await this.contactRepository.delete({ id, accountId });
  }

  async removeSuppression(email: string, groupId: number) {
    return await this.suppressionRepository.delete({ email, groupId });
  }

  async createContact(newContact: Contact): Promise<ContactEntity> {
    const contact = this.contactRepository.create(newContact);

    return await this.contactRepository.save(contact);
  }

  async updateContact(contact: ContactEntity, newContact: any): Promise<ContactEntity> {
    const result = await this.updateContactWithChanges(contact, newContact);
    return result.contact;
  }

  async updateContactWithChanges(contact: ContactEntity, newContact: any): Promise<{ contact: ContactEntity; changedFields: Record<string, any> }> {
    const valuesToUpdate = this.getChangesOnly(contact, newContact);
    if (Object.keys(valuesToUpdate).length === 0) {
      return { contact, changedFields: {} };
    }

    delete contact.customFields;
    delete contact.contactDevices;

    const contactUpdate = this.contactRepository.create(valuesToUpdate);

    await this.contactRepository
      .createQueryBuilder('contacts')
      .update()
      .set(contactUpdate)
      .where('account_id = :accountId AND id = :id', {
        accountId: contact.accountId,
        id: contact.id,
      })
      .execute();

    // Merge updated values into contact for return
    Object.assign(contact, valuesToUpdate);

    return { contact, changedFields: valuesToUpdate };
  }

  initializeOrUpdateLeadsCount(contact: ContactEntity | Contact): ContactEntity | Contact {
    const properties: any = contact.properties;
    if (!properties) {
      contact['properties'] = {
        leadsCount: 1,
      };
      return contact;
    }

    if (properties && !properties.leadsCount) {
      contact.properties['leadsCount'] = 1;
      return contact;
    }

    if (properties && properties.leadsCount) {
      const updatedCount: number = Number.parseInt(properties.leadsCount) + 1;
      contact.properties.leadsCount = updatedCount;
      return contact;
    }

    return contact;
  }

  async getCustomFields(names: string[], accountId: number) {
    return await this.customFieldsRepository.find({
      where: {
        name: In(names),
        accountId,
      },
    });
  }

  async getAllCustomFieldsCached(accountId: number): Promise<CustomFieldsEntity[]> {
    const redisClient = this.redisService.getOrThrow();
    const redisKey = `custom_fields:${accountId}`;

    const cached = await redisClient.get(redisKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const customFields = await this.customFieldsRepository.find({
      where: { accountId },
    });

    await redisClient.set(redisKey, JSON.stringify(customFields), 'EX', 3600); // 1 hour TTL

    return customFields;
  }

  async createOrUpdateCustomFields(contactsQuery: any) {
    return await this.dataSource.query(contactsQuery);
  }

  async createDevice(contactDevices: ContactDevice[]) {
    return this.contactDevicesRepository
      .createQueryBuilder('contacts_devices')
      .insert()
      .values(contactDevices)
      .orUpdate(['ip', 'subscription_url', 'contact_id'], ['account_id', 'token'])
      .execute();
  }

  getChangesOnly(originalEntity: any, newEntity: any) {
    const newObject = {};
    const newKeys = Object.keys(newEntity);
    for (const key of newKeys) {
      if (!originalEntity.hasOwnProperty(key) || !this.areValuesEqual(originalEntity[key], newEntity[key])) {
        newObject[key] = newEntity[key];
      }
    }

    return newObject;
  }

  /**
   * Compares two values for equality, handling type coercion for decimals
   * (TypeORM returns decimal columns as strings from PostgreSQL)
   */
  private areValuesEqual(originalValue: any, newValue: any): boolean {
    // Both null/undefined
    if (originalValue == null && newValue == null) {
      return true;
    }

    // One is null/undefined, the other is not
    if (originalValue == null || newValue == null) {
      return false;
    }

    // Handle numeric comparisons (decimal columns come back as strings)
    if (typeof originalValue === 'string' && typeof newValue === 'number') {
      return parseFloat(originalValue) === newValue;
    }
    if (typeof originalValue === 'number' && typeof newValue === 'string') {
      return originalValue === parseFloat(newValue);
    }

    // Handle Date comparisons
    if (originalValue instanceof Date && newValue instanceof Date) {
      return originalValue.getTime() === newValue.getTime();
    }

    // Default strict equality
    return originalValue === newValue;
  }

  async getContactsCustomFields(contactId: number, accountId: number) {
    return await this.contactCustomFieldsRepository.find({
      where: {
        contactId,
        accountId,
      },
    });
  }

  async createLead(newLead: Lead): Promise<LeadsEntity> {
    const lead = this.leadsRepository.create(newLead);
    return await this.leadsRepository.save(lead);
  }

  async findClusterMessage(options) {
    console.log(`LOG CLUSTER: ${JSON.stringify(options)}`);
    return await this.clusterMessageRepository.findOne({
      where: {
        ...options,
      },
    });
  }

  async deleteContactTag(contactId: number, accountId: number) {
    return await this.contactTagRepository.delete({ contactId, accountId });
  }

  async eventLogResubscribed(eventLog: EventLogResubscribed) {
    const query = `INSERT INTO events_logs (time, date, account_id, contact_id, email, event, reason, url, ip, country, region, city) 
    values (
      current_timestamp,
      '${eventLog.currentDate}',
      ${eventLog.accountId},
      ${eventLog.contactId},
      '${eventLog.email}',
      '${eventLog.event}',
      '${eventLog.reason}',
      '${eventLog.url}',
      ${eventLog.ip ? `'${eventLog.ip}'` : null},
      ${eventLog.country ? `'${eventLog.country}'` : null},
      ${eventLog.region ? `'${eventLog.region}'` : null},
      ${eventLog.city ? `'${eventLog.city}'` : null}
      )`;

    return await this.entityManager.query(query);
  }
}
