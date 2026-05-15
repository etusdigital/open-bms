import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Campaign, CampaignMessageType } from 'src/interfaces';
import { Repository, MoreThan, EntityManager } from 'typeorm';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AccountEntity } from './entities/account.entity';
import { MessageEntity } from './entities/message.entity';
import { CampaignContactEntity } from './entities/campaign-contact.entity';
import { CampaignMessageEntity } from './entities/campaign-message.entity';
import { CampaignEntity } from './entities/campaign.entity';
import { ContactEntity } from './entities/contact.entity';
import { CustomFieldsEntity } from './entities/custom-fields.entity';
import { TagProcessProvider } from 'src/providers/tag-process.provider';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class MsgopsService {
  private readonly logger = new Logger(MsgopsService.name);

  constructor(
    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,
    @InjectRepository(CampaignMessageEntity)
    private readonly campaignMessageRepository: Repository<CampaignMessageEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactRepository: Repository<ContactEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(CampaignContactEntity)
    private readonly campaignContactRepository: Repository<CampaignContactEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(CustomFieldsEntity)
    private readonly customFieldRepository: Repository<CustomFieldsEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
    private entityManager: EntityManager,
    private tagProcessProvider: TagProcessProvider,
  ) {}

  async findByTags(campaign: Campaign, currentContactId: number, finalContactId: number): Promise<ContactEntity[]> {
    try {
      const query = await this.contactRepository
        .createQueryBuilder('contacts')
        .innerJoin('contacts.campaignContacts', 'campaignContacts')
        .leftJoinAndSelect('contacts.customFields', 'customFields')
        .leftJoinAndSelect('customFields.customFieldType', 'customFieldType')
        .select(['contacts', 'customFields', 'customFieldType'])
        .where('campaignContacts.campaign_id = :campaignId', { campaignId: campaign.id })
        .andWhere('contacts.account_id = :accountId', {
          accountId: campaign.account.id,
        })
        .orderBy('contacts.id', 'ASC');

      if (!finalContactId) {
        const limit = parseInt(process.env.LIMIT_CONTACT_BATCH);
        query.andWhere('campaignContacts.order_number > :currentContactId', { currentContactId }).limit(limit);
      } else {
        query.andWhere('campaignContacts.order_number BETWEEN :currentContactId AND :finalContactId', {
          currentContactId,
          finalContactId,
        });
      }

      if (campaign.messageType === CampaignMessageType.EMAIL) {
        query.andWhere('contacts.has_email = true');
        query.andWhere('contacts.is_valid = :isValid AND contacts.is_unsubscribed = :unsubscribed AND contacts.has_bounced = :bounced AND contacts.is_blocked = :blocked', {
          isValid: true,
          unsubscribed: false,
          blocked: false,
          bounced: false,
        });
      }

      if (campaign.messageType === CampaignMessageType.SMS) {
        query.andWhere('contacts.has_phone = true');
      }

      if (campaign.messageType === CampaignMessageType.WHATSAPP) {
        query.andWhere('contacts.has_whatsapp = true');
      }

      if ([CampaignMessageType.MOBILEPUSH, CampaignMessageType.WEBPUSH].includes(campaign.messageType)) {
        query.leftJoinAndSelect('contacts.contactDevices', 'contactsDevices').andWhere('contactsDevices.type = :type', { type: campaign.messageType });
      }

      return await query.getMany();
    } catch (error) {
      this.logger.error(`findByTags failed for campaign ${campaign.id}`, error?.stack ?? String(error));
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async countByTags(campaign: Campaign, lastSentId: number, finalId: number) {
    try {
      const limit = await this.getLimit(campaign);
      let subquery = '';
      if (lastSentId) {
        subquery += ` AND order_number > ${lastSentId} `;
      }
      if (finalId) {
        subquery += ` AND order_number <= ${finalId} `;
      }
      const query = `SELECT tb1.order_number FROM (SELECT order_number, ROW_NUMBER() OVER(order by order_number) AS count_row,
        (SELECT COUNT(*) FROM campaigns_contacts WHERE campaign_id = ${campaign.id} ${subquery}) AS max_row
        FROM campaigns_contacts WHERE campaign_id = ${campaign.id} ${subquery}) tb1 
        WHERE (tb1.count_row % ${limit} = 0 OR (tb1.count_row = tb1.max_row) OR (tb1.max_row < ${limit} and tb1.count_row = tb1.max_row))
        ORDER BY tb1.order_number DESC`;

      return await this.entityManager.query(query);
    } catch (error) {
      this.logger.error(`countByTags failed for campaign ${campaign.id}`, error?.stack ?? String(error));
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getLimit(campaign: Campaign) {
    const contactsCampaign = await this.countByCampaign(campaign.id);
    const dividerSpread = campaign.spreadSending > 0 ? Math.ceil(contactsCampaign / campaign.spreadSending) : 0;

    const limit = parseInt(process.env.LIMIT_CONTACT_BATCH);
    if (dividerSpread < limit && dividerSpread > 0) {
      return dividerSpread;
    }
    return limit;
  }

  async countByCampaign(campaignId: number) {
    return await this.campaignContactRepository.count({
      where: {
        campaignId,
      },
    });
  }

  async getCampaign(campaignId: number) {
    const campaign = await this.campaignRepository.findOne({ where: { id: campaignId } });
    campaign.account = await this.findAccount(campaign.accountId);
    return campaign;
  }

  async createContactsSend(campaign: CampaignEntity) {
    if (campaign.runSegment) {
      const tagsJson = JSON.parse(JSON.stringify(campaign.tags));
      const segmentsPromisses = tagsJson.map((item) => this.tagProcessProvider.processSegment(item.id));
      await Promise.all(segmentsPromisses);
    }
    const orderByRowNumber = 'ORDER BY c.id ASC';
    const query = `INSERT INTO campaigns_contacts (
      SELECT ${campaign.id}, tb1.contact_id,
      row_number() OVER (${orderByRowNumber}) 
      from (${campaign.query}) tb1
      INNER JOIN contacts c ON c.id = tb1.contact_id AND c.account_id = ${campaign.accountId} AND is_active = true
    )
    ON CONFLICT (campaign_id, contact_id) DO NOTHING RETURNING contact_id`;

    return await this.entityManager.query(query);
  }

  async findAccountConfig(accountId: number, name: string) {
    return await this.accountConfigRepository.findOne({
      where: {
        accountId,
        name,
      },
    });
  }

  async updateCampaign(id, campaign) {
    return await this.campaignRepository.update(id, campaign);
  }

  async updateCampaignMessage(campaignMessage) {
    return await this.campaignMessageRepository.save({
      ...campaignMessage,
    });
  }

  async startedTestAB(campaignId: number, quatityMessages: number, percent: number) {
    const query = `
    WITH lastLine AS
    (
          SELECT COUNT(*) countLastLine
          FROM   (
                          SELECT   order_number,
                                    Percent_rank() OVER (ORDER BY order_number ASC) AS pct_rank
                          FROM     campaigns_contacts WHERE campaign_id = ${campaignId} ) t2
          WHERE  pct_rank <= ${percent}
    )
    SELECT * from (
    SELECT t.*,
      ROW_NUMBER() OVER(order by order_number) AS count_row,
          (
                  SELECT countLastLine
                  FROM   lastLine)
    FROM   (
                    SELECT   order_number,
                            percent_rank() OVER (ORDER BY order_number ASC) AS pct_rank
                    FROM     campaigns_contacts WHERE campaign_id = ${campaignId} ) t WHERE pct_rank <= ${percent}


      ) tb1
      WHERE ( tb1.count_row % (SELECT ROUND(countLastLine / ${quatityMessages.toFixed(1)}) FROM lastLine) = 0 
      AND tb1.count_row / (SELECT ROUND(countLastLine / ${quatityMessages.toFixed(1)}) FROM lastLine) < ${quatityMessages})
      OR tb1.countLastLine = tb1.count_row
      order by order_number DESC;
    `;

    return await this.entityManager.query(query);
  }

  async findAccount(id) {
    const account = await this.accountRepository.findOne({ where: { id } });
    account.customFields = await this.customFieldRepository.find({ where: { accountId: id } });
    account.accountConfigs = await this.accountConfigRepository.find({ where: { accountId: id, isLoadConfig: true } });
    return account;
  }

  async countContactsTestAb(campaignId, lastId) {
    return await this.campaignContactRepository.count({
      where: {
        campaignId,
        contactId: MoreThan(lastId),
      },
    });
  }

  async findMessageById(messageId) {
    return await this.messageRepository.findOne({ where: { id: messageId } });
  }
}
