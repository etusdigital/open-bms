import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from '../providers/redis/redis.service';
import { MessageEntity } from './entities/message.entity';
import { ContactEntity } from './entities/contact.entity';
import { CustomFieldKeyType, Email } from 'src/interfaces';
import { ContactCustomFieldEntity } from './entities/contact-custom-field.entity';
import { LeadsEntity } from './entities/leads.entity';
import { ClickhouseProvider } from '../providers/clickhouse.provider';

@Injectable()
export class MsgopsService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactRepository: Repository<ContactEntity>,
    @InjectRepository(ContactCustomFieldEntity)
    private readonly contactCustomFieldsRepository: Repository<ContactCustomFieldEntity>,
    @InjectRepository(LeadsEntity)
    private readonly leadRepository: Repository<LeadsEntity>,
    private readonly redisService: RedisService,
    private entityManager: EntityManager,
    private readonly clickhouseProvider: ClickhouseProvider,
  ) {}

  async getMessageById(messageId: number): Promise<any> {
    const redisClient = this.redisService.getOrThrow();
    const redisKey = `step_message:${messageId}`;
    const messageCache: Email = await redisClient.get(redisKey).then((message) => JSON.parse(message));
    if (messageCache) return messageCache;

    const message = await this.messageRepository.findOne({
      where: {
        id: messageId,
      },
    });
    const messageFormatted = message.type === 'web-push' ? message : await this.parseMessage(message);
    await redisClient.set(redisKey, JSON.stringify(messageFormatted));

    return messageFormatted;
  }

  async findContactById(id: number, accountId: number, loadContacts, keyType?: CustomFieldKeyType) {
    const getContacts = this.contactRepository.createQueryBuilder('contact').where('contact.id = :id AND contact.account_id = :accountId', { id, accountId });

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

  async parseMessage(message: MessageEntity): Promise<Email> {
    const messageFormatted = {
      ...message,
      location: {
        bucketName: message.bucketName,
        fileName: message.fileName,
      },
      from: {
        firstName: message.fromName,
        email: message.fromMail,
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { bucketName, fileName, fromName, fromMail, ...messageReturn } = messageFormatted;

    return messageReturn;
  }

  async updateContact(params, contactId: number, accountId: number) {
    await this.contactRepository.createQueryBuilder('contacts').update().set(params).where('id = :contactId AND account_id = :accountId', { contactId, accountId }).execute();
  }

  async createOrUpdateCustomFields(userCustomFields: ContactCustomFieldEntity[]) {
    this.contactCustomFieldsRepository
      .createQueryBuilder('contact_custom_field')
      .insert()
      .values(userCustomFields)
      .orUpdate(['value'], ['account_id', 'contact_id', 'custom_field_id'])
      .execute();
  }

  async queryRunner(query: string) {
    return await this.entityManager.query(query);
  }

  async queryEventsLogs(query: string) {
    return await this.clickhouseProvider.runQuery(query);
  }
}
