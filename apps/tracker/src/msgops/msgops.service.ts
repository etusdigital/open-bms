import { Injectable, NotFoundException } from '@nestjs/common';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ContactEntity } from './entities/contact.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AccountApiKeyEntity } from './entities/account-api-key.entity';
import { ShortLinkEntity } from './entities/short-link.entity';
import { ContactTagEntity } from './entities/contact-tag.entity';
import { ClsService } from 'nestjs-cls';
import { FormatterUtils } from 'src/utils/formatter.utils';
import { RedisService } from '../providers/redis/redis.service';
import { createHash } from 'crypto';
@Injectable()
export class MsgopsService {
  constructor(
    @InjectRepository(ContactEntity)
    private readonly contactRepository: Repository<ContactEntity>,
    @InjectRepository(ContactTagEntity)
    private readonly contactTagRepository: Repository<ContactTagEntity>,
    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,
    @InjectRepository(AccountApiKeyEntity)
    private readonly accountApiKeyRepository: Repository<AccountApiKeyEntity>,
    @InjectRepository(ShortLinkEntity)
    private readonly shortLinkRepository: Repository<ShortLinkEntity>,
    private readonly formatterUtils: FormatterUtils,
    private readonly redisService: RedisService,
    private readonly cls: ClsService,
  ) {}

  private hashApiKey(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  async findContact(filter: string, value: string, accountId = null): Promise<ContactEntity> {
    const columnsMap = { e: 'email', h: 'hashedEmail', u: 'uuid' };
    const _filter: string = columnsMap[filter];

    if (_filter && _filter === 'email') {
      value = this.formatterUtils.formatterEmail(value);
    }

    return await this.contactRepository.findOneOrFail({
      where: {
        [columnsMap[filter]]: value,
        accountId: accountId ? accountId : this.cls.get('accountId'),
      },
    });
  }

  async findContactTags(contactId) {
    const segmentsRedis = await this.redisService.getOrThrow().get(`real_time_segment:${this.cls.get('accountId')}`);
    const segmentsCache = segmentsRedis ? JSON.parse(segmentsRedis) : [];
    const contactsTags = await this.contactTagRepository.find({
      where: {
        contactId: contactId,
        accountId: this.cls.get('accountId'),
        tagId: In(segmentsCache),
      },
    });
    return contactsTags.map((contactTag) => {
      return contactTag.tagId;
    });
  }

  async accountsByEmail(email: string): Promise<ContactEntity[]> {
    const accounts = [1, 5, 6, 10, 16, 19];

    return await this.contactRepository.find({
      where: {
        email,
        accountId: In(accounts),
      },
      select: ['accountId', 'lo'],
    });
  }

  async contactByEmail(accountId: number, email: string, options?: string[]): Promise<ContactEntity> {
    const query = this.contactRepository.createQueryBuilder('contacts').where({ email, accountId });

    if (options && options.includes('details')) {
      query.select('contacts.*');
    } else {
      query.select('contacts.email, contacts.firstName,  contacts.lastName, contacts.phone');
    }

    if (options) {
      if (options.includes('tags')) {
        const subQuery = `SELECT contacts.id contact_id, jsonb_object_agg(id, tg.name) tags 
          FROM contacts_tags ctg INNER JOIN tags tg ON tg.id = ctg.tag_id 
          WHERE tg.type = 'tag' AND ctg.account_id = ${accountId} AND ctg.contact_id = contacts.id`;

        query.leftJoin(
          (qb) => {
            qb.getQuery = () => `LATERAL (${subQuery})`;
            qb.setParameters({});
            return qb;
          },
          `sub`,
          `contacts.id = sub.contact_id`,
        );

        query.addSelect('tags');
      }

      if (options.includes('segments')) {
        const subQuery = `SELECT contacts.id contact_id, jsonb_object_agg(id, tg.name) segments 
          FROM contacts_tags ctg INNER JOIN tags tg ON tg.id = ctg.tag_id 
          WHERE tg.type = 'segment' AND ctg.account_id = ${accountId} AND ctg.contact_id = contacts.id`;

        query.leftJoin(
          (qb) => {
            qb.getQuery = () => `LATERAL (${subQuery})`;
            qb.setParameters({});
            return qb;
          },
          `subseg`,
          `contacts.id = subseg.contact_id`,
        );

        query.addSelect('segments');
      }

      if (options.includes('customFields')) {
        const subQuery = `SELECT contacts.id contact_id, jsonb_agg(jsonb_build_object('id', cf.id, 'name', cf.name, 'value', ccf.value)) AS customFields 
          FROM contacts_custom_fields ccf INNER JOIN custom_fields cf ON cf.id = ccf.custom_field_id AND cf.account_id = ccf.account_id
          WHERE ccf.account_id = ${accountId} AND ccf.contact_id = contacts.id`;

        query.leftJoin(
          (qb) => {
            qb.getQuery = () => `LATERAL (${subQuery})`;
            qb.setParameters({});
            return qb;
          },
          `subcf`,
          `contacts.id = subcf.contact_id`,
        );

        query.addSelect('customFields');
      }
    }

    const contact = await query.getRawOne();
    if (!contact) {
      throw new NotFoundException();
    }
    return contact;
  }

  async findByConfig(value: string): Promise<AccountConfigEntity> {
    const keyName = `accountConfig:${value}`;
    const config = await this.redisService.getOrThrow().get(`${keyName}`);
    if (config) {
      return JSON.parse(config);
    }

    // 1. Try managed keys table first (accounts_api_keys)
    const keyHash = this.hashApiKey(value);
    const now = new Date();
    const managedKey = await this.accountApiKeyRepository.findOne({
      where: [
        { keyHash, status: 'active', revokedAt: IsNull(), expiresAt: IsNull() },
        { keyHash, status: 'active', revokedAt: IsNull(), expiresAt: MoreThan(now) },
      ],
    });

    if (managedKey) {
      const result = { accountId: managedKey.accountId, name: 'api_key', value } as AccountConfigEntity;
      const expireInHours = 24;
      await this.redisService.getOrThrow().set(`${keyName}`, JSON.stringify(result), 'EX', 60 * 60 * expireInHours);
      return result;
    }

    // 2. Fallback to legacy accounts_configs
    const accountConfig = await this.accountConfigRepository.findOne({
      where: [
        {
          name: 'api_key_tracker',
          value,
        },
        {
          name: 'api_key',
          value,
        },
      ],
    });

    if (accountConfig) {
      const expireInHours = 24;
      await this.redisService.getOrThrow().set(`${keyName}`, JSON.stringify(accountConfig), 'EX', 60 * 60 * expireInHours);
    }

    return accountConfig;
  }

  async findLongUrl(shortCode) {
    const keyName = `redirect_short_link:${shortCode}`;
    const longUrl = await this.redisService.getOrThrow().get(`${keyName}`);
    if (longUrl) {
      return longUrl;
    }
    const shortLink = await this.shortLinkRepository.findOne({
      where: {
        shortCode,
      },
    });

    if (!shortLink) {
      return undefined;
    }

    if (shortLink) {
      const expireInHours = 24;
      await this.redisService.getOrThrow().set(`${keyName}`, shortLink.longUrl, 'EX', 60 * 60 * expireInHours);
    }

    return shortLink.longUrl;
  }
}
