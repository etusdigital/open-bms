import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { TagEntity } from '../../entities/tag.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { TagDto } from './dto/tags.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { ContactTagEntity } from '../../entities/contact-tag.entity';
import { TagsPageDto } from './dto/tagsPage.dto';
import { UtilsService } from '../../utils/utils.service';
import { SegmentDto } from './dto/segments.dto';
import { SchedulerService } from '../../providers/queue/scheduler.service';
import { AutomationsService } from '../automations/automations.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { RedisService } from '../../providers/redis.provider';
import { AccountsService } from '../accounts/accounts.service';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { ClsService } from 'nestjs-cls';
import { AccountCacheService } from '../accounts/account-cache.service';

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);
  private schedulerQueueName: string;
  private schedulerEndpoint: string;

  constructor(
    @InjectRepository(TagEntity)
    private readonly tagsRepository: Repository<TagEntity>,
    @InjectRepository(ContactTagEntity)
    private readonly contactsTagsRepository: Repository<ContactTagEntity>,
    private readonly httpService: HttpService,

    private readonly utilsService: UtilsService,
    private readonly automationsServices: AutomationsService,
    private readonly campaignsServices: CampaignsService,
    private readonly accountService: AccountsService,
    private readonly scheduler: SchedulerService,
    private readonly redisService: RedisService,
    private readonly cls: ClsService,
    private readonly accountCacheService: AccountCacheService,
  ) {
    this.schedulerQueueName = process.env.GOOGLE_TASK_SEGMENT;
    this.schedulerEndpoint = process.env.TAG_PROCESS_ENDPOINT;
  }

  async findAll(params): Promise<Array<TagEntity>> {
    try {
      return await this.tagsRepository.find({
        where: {
          type: params.type || Not(IsNull()),
          ...(params.status ? { status: Not('inactive') } : {}),
          accountId: params.accountId ? params.accountId : this.cls.get('accountId'),
        },
        order: {
          name: 'ASC',
        },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listPaginated(params: TagsPageDto): Promise<PaginationDto<TagDto>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'created_at';
      const order = params.order ? params.order : 'DESC';

      let newResults: TagDto[] = [];

      const tagsQuery = await this.tagsRepository
        .createQueryBuilder('tags')
        .where({ accountId: this.cls.get('accountId') })
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`tags.${sortBy}`, `${order}`);

      if (params.title) {
        if (Array.isArray(params.title)) {
          const search = [params.title].flat();
          const tagNames = search.map((tag) => tag.toLowerCase());

          tagsQuery.andWhere(`tags.name IN (:...name)`, { name: tagNames });
        } else {
          tagsQuery.andWhere(`(tags.name iLike :search OR tags.description iLike :search)`, {
            search: `%${params.title}%`,
          });
        }
      }

      if (params.type) {
        tagsQuery.andWhere('tags.type = :type', { type: params.type });
      }

      if (params.status) {
        const status = [params.status];
        if (params.status === 'active') {
          status.push('reactivating');
        }
        tagsQuery.andWhere('tags.status IN (:...status)', { status });
      }

      const [results, total] = await tagsQuery.getManyAndCount();

      newResults = results;

      if (params.withCount) {
        const idsTags = results.map((tagsId) => tagsId.id);

        if (idsTags.length !== 0) {
          const numberContactsByTag = await this.getNumberContactsByTag(idsTags);

          for (const newResult of newResults) {
            for (const numberContacts of numberContactsByTag) {
              if (numberContacts.tag_id == newResult.id) {
                newResult.countContacts = numberContacts.count;
                break;
              }
            }
          }
        }
      }

      if (params.type === 'segment' && newResults.length) {
        const redisClient = this.redisService.getClient();
        const redisItems = await redisClient.mget(newResults.map((tag) => `processingsegment:${tag.id}`));
        if (redisItems) {
          for (const [index, value] of redisItems.entries()) {
            newResults[index].isProcessing = value ? true : false;
          }
        }
      }

      return new PaginationDto<TagDto>({
        results: newResults,
        total,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneById(id: number): Promise<TagEntity> {
    const tag = await this.tagsRepository.findOne({ where: { id, accountId: this.cls.get('accountId') } });
    if (!tag) {
      throw new HttpException('Tag not found', HttpStatus.NOT_FOUND);
    }
    if (tag.type === 'segment') {
      const redisClient = this.redisService.getClient();
      const redisItem = await redisClient.get(`processingsegment:${tag.id}`);
      if (redisItem) {
        tag.isProcessing = true;
      }
    }

    return tag;
  }

  async findOneByName(name: string): Promise<TagEntity> {
    try {
      return await this.tagsRepository.findOne({
        where: {
          name,
          accountId: this.cls.get('accountId'),
        },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async validateNames(params: TagsPageDto) {
    return this.tagsRepository
      .createQueryBuilder('tags')
      .where({
        accountId: this.cls.get('accountId'),
        name: params.titleCreate.trim().toLowerCase(),
        ...(params.id && { id: Not(params.id) }),
      })
      .getMany();
  }

  async create(tagsDto: TagDto | SegmentDto, accountId?: number): Promise<TagEntity> {
    const resolvedAccountId = accountId ?? this.cls.get<number | undefined>('accountId');
    if (!resolvedAccountId) {
      throw new BadRequestException('Account context is required. Send the Account-Id header.');
    }
    tagsDto.accountId = resolvedAccountId;

    try {
      const tag = this.tagsRepository.create(tagsDto);
      const savedTag = await this.tagsRepository.save(tag);

      // Invalidate account cache
      this.accountCacheService.invalidateAccountCacheAsync(savedTag.accountId);

      return savedTag;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ConflictException('A tag or segment with that name already exists in this account');
      }
      if (error instanceof HttpException) throw error;

      this.logger.error('Failed to create tag', error?.stack || error);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createSegment(segmentDto: SegmentDto): Promise<TagEntity> {
    try {
      const tag = await this.create({
        ...segmentDto,
        steps: JSON.stringify(segmentDto.steps),
        recurrence: 24,
      });
      if (segmentDto.isRealTimeSegment) {
        await this.realtimeUpdate(tag, 'add');
      }

      let currentTime = new Date();
      if (segmentDto.name.includes(' - copy')) {
        currentTime = new Date(currentTime.getTime() + 10 * 60000);
      }

      const response = await this.scheduler.create(tag.id, currentTime, this.schedulerEndpoint, this.schedulerQueueName);

      const updatedTag = await this.update(tag.id, {
        name: segmentDto.name,
        scheduleCloudTaskId: response[0].name,
      });

      // Invalidate account cache (already invalidated in create, but for safety)
      this.accountCacheService.invalidateAccountCacheAsync(tag.accountId);

      return updatedTag;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ConflictException('A tag or segment with that name already exists in this account');
      }
      if (error instanceof HttpException) throw error;

      this.logger.error('Failed to create segment', error?.stack || error);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateSegment(id: number, segmentDto: SegmentDto): Promise<TagEntity> {
    const isProcessing = await this.findProcessingSegment(id);
    if (isProcessing) {
      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: 'Segment is already running, wait it finish.',
        },
        HttpStatus.CONFLICT,
      );
    }

    try {
      const tag = await this.tagsRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });

      if (!tag.isRealTimeSegment && segmentDto.isRealTimeSegment) {
        await this.realtimeUpdate(tag, 'add');
      } else if (tag.isRealTimeSegment && !segmentDto.isRealTimeSegment) {
        await this.realtimeUpdate(tag, 'remove');
      }

      try {
        await this.scheduler.delete(tag.scheduleCloudTaskId, this.schedulerQueueName);
      } catch (error) {
        console.log('Error to delete task', error);
      }

      const currentTime = new Date(new Date().getTime() + 5000);
      const response = await this.scheduler.create(tag.id, currentTime, this.schedulerEndpoint, this.schedulerQueueName);
      segmentDto.scheduleCloudTaskId = response[0].name;

      const updatedTag = await this.update(tag.id, {
        ...segmentDto,
        steps: JSON.stringify(segmentDto.steps),
      });

      // Invalidate account cache
      this.accountCacheService.invalidateAccountCacheAsync(tag.accountId);

      return updatedTag;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ConflictException('A tag or segment with that name already exists in this account');
      }
      if (error instanceof HttpException) throw error;

      this.logger.error('Failed to update segment', error?.stack || error);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async realtimeUpdate(tag: TagEntity, type: string) {
    const redisClient = await this.redisService.getClient();
    const redisKey = `real_time_segment:${tag.accountId}`;
    const segmentsRedis = await redisClient.get(redisKey);
    const segmentsCache = segmentsRedis ? JSON.parse(segmentsRedis) : [];
    if (type === 'add') {
      segmentsCache.push(tag.id);
    } else {
      const index = segmentsCache.indexOf(tag.id);
      if (index !== -1) {
        segmentsCache.splice(index, 1);
      }
    }
    await redisClient.set(redisKey, JSON.stringify(segmentsCache));
  }

  async createCopy(id: number): Promise<TagEntity> {
    const segmentCopy = await this.findOneById(id);
    segmentCopy.name += ' - copy';
    segmentCopy.segmentInfo = [];
    segmentCopy.steps = JSON.parse(segmentCopy.steps);

    delete segmentCopy.id;
    delete segmentCopy.createdAt;
    delete segmentCopy.updatedAt;
    delete segmentCopy.scheduleCloudTaskId;

    return await this.createSegment(segmentCopy);
  }

  async update(id: number, tagDto: TagDto | SegmentDto): Promise<TagEntity> {
    try {
      const tag = await this.tagsRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });

      if (tag.name !== tagDto.name) {
        await this.updateAutomationAndCampaign(tagDto.id, tag.name, tagDto.name);
      }

      await this.utilsService.deleteCache(`tag:${tag.name}:${tag.accountId || this.cls.get('accountId')}`);

      this.tagsRepository.merge(tag, tagDto);
      await this.tagsRepository.update(id, tag);

      // Invalidar cache da conta
      this.accountCacheService.invalidateAccountCacheAsync(tag.accountId);

      return tag;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ConflictException('A tag or segment with that name already exists in this account');
      }
      if (error instanceof HttpException) throw error;

      this.logger.error('Failed to update tag', error?.stack || error);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async delete(id: number) {
    const tag = await this.tagsRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });
    const automationsUsingTag = await this.automationsServices.validateTagUsage(tag.id, tag.name);
    const campaignUsingTag = await this.campaignsServices.validateTagUsage(tag.id);
    if (automationsUsingTag || campaignUsingTag) {
      const tagsInUse = [];
      if (automationsUsingTag) tagsInUse.push('automações');
      if (campaignUsingTag) tagsInUse.push('campanhas');

      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: `A tag não pode ser apagada por estar sendo usada em: ${tagsInUse.join(' e ')}`,
        },
        HttpStatus.CONFLICT,
      );
    }

    try {
      if (tag.type === 'segment' && tag.scheduleCloudTaskId) {
        if (tag.isRealTimeSegment) {
          await this.realtimeUpdate(tag, 'remove');
        }
        await this.scheduler.delete(tag.scheduleCloudTaskId, this.schedulerQueueName);
      }
      const deleteCacheKeys = [`tag:${tag.name}:${tag.accountId}`, `automations_tag:${tag.accountId}:${tag.id}`];
      const deletedTag = await this.tagsRepository.delete(id);
      if (deletedTag) {
        await this.contactsTagsRepository.delete({ tagId: id, accountId: this.cls.get('accountId') });
      }
      await this.utilsService.deleteCache(deleteCacheKeys);

      // Invalidar cache da conta
      this.accountCacheService.invalidateAccountCacheAsync(tag.accountId);

      return deletedTag;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getNumberContactsByTag(array_tags_id: any) {
    return await this.contactsTagsRepository
      .createQueryBuilder('contacts_tags')
      .select(['tag_id', 'COUNT(tag_id)'])
      .where('account_id = :accountId AND is_active AND tag_id IN (:...tags_id)', {
        tags_id: array_tags_id,
        accountId: this.cls.get('accountId'),
      })
      .groupBy('tag_id')
      .execute();
  }

  async runSegment(id: number) {
    const isProcessing = await this.findProcessingSegment(id);
    if (isProcessing) {
      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: 'Segment is already running, wait it finish.',
        },
        HttpStatus.CONFLICT,
      );
    }

    try {
      const segment = await this.tagsRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });
      return await this.scheduler.callRunTask(segment.scheduleCloudTaskId, this.schedulerQueueName);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findProcessingSegment(id: number) {
    const redisKey = `processingsegment:${id}`;
    const redisClient = await this.redisService.getClient();
    return await redisClient.exists(redisKey);
  }

  async checkSegmentDuration() {
    const isSegmentAbove = await this.tagsRepository
      .createQueryBuilder('tags')
      .where("(CAST(tags.segment_info->>'duration' AS INTEGER) > :minDuration " + "OR tags.segment_info->>'status' = :status) AND type = 'segment' AND status = 'active'", {
        minDuration: 20 * 60 * 1000,
        status: 'false',
      })
      .getMany();

    const failureEmbed = {
      title: 'Segmentos com falha',
      description: '',
      color: this.hexToDecimal('#ff0000'),
    };
    const durationEmbed = {
      title: 'Segmentos com alta duração',
      description: '',
      color: this.hexToDecimal('#ff0000'),
    };

    for (const segment of isSegmentAbove) {
      const segmentInfo = JSON.parse(JSON.stringify(segment.segmentInfo));
      if (segmentInfo.status === false) {
        failureEmbed.description += `- **ID**: ${segment.id} - **Nome**: ${segment.name} - **AccountID**: ${segment.accountId}\n`;
      } else {
        durationEmbed.description += `- **ID**: ${segment.id} - **Nome**: ${segment.name} - **AccountID**: ${segment.accountId} - **Duração**: ${this.convertDurations(
          segmentInfo.duration / 1000 / 60,
        )} minutos\n`;
      }
    }
    const params = {
      username: 'Relatório de Segmentos',
      embeds: [failureEmbed, durationEmbed],
    };

    return await this.sendDiscordNotification(JSON.stringify(params));
  }

  async sendDiscordNotification(notification: string) {
    const result = await this.httpService
      .post(`${process.env.DISCORD_API_WEBHOOK}`, notification, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(notification),
        },
      })
      .toPromise();
    return result.data;
  }

  convertDurations(totalMinutes: number): string {
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    return `${minutes}:${seconds}`;
  }

  hexToDecimal(hex: string) {
    return parseInt(hex.replace('#', ''), 16);
  }

  async getBaseSizeStats() {
    const accountId = this.cls.get('accountId');

    const segment = await this.tagsRepository.findOne({
      where: {
        type: 'segment-base-size',
        accountId,
      },
    });

    if (!segment) {
      throw new HttpException('Base size segment not found', HttpStatus.NOT_FOUND);
    }

    return segment;
  }

  async updateAutomationAndCampaign(id: number, oldName: string, newName: string) {
    const automationQuery = `
    UPDATE automations 
      SET 
          steps = REPLACE(steps::text, '"id": ${id}, "name": "${oldName}"', '"id": ${id}, "name": "${newName}"')::jsonb,
          triggers = REPLACE(triggers::text, '"id": ${id}, "name": "${oldName}"', '"id": ${id}, "name": "${newName}"')::jsonb
      WHERE 
          steps::text LIKE '%"id": ${id}, "name": "${oldName}"%'
          OR triggers::text LIKE '%"id": ${id}, "name": "${oldName}"%';
      `;

    const campaignQuery = `
    UPDATE campaigns
      SET 
          tags = REPLACE(tags::text, '"id": ${id}, "name": "${oldName}"', '"id": ${id}, "name": "${newName}"')::jsonb,
          steps = REPLACE(steps::text, '"id": ${id}, "name": "${oldName}"', '"id": ${id}, "name": "${newName}"')::jsonb
      WHERE 
          tags::text LIKE '%"id": ${id}, "name": "${oldName}"%'
          OR steps::text LIKE '%"id": ${id}, "name": "${oldName}"%';
    `;

    const entityManager = this.tagsRepository.manager;
    await entityManager.query('START TRANSACTION');
    try {
      await entityManager.query(campaignQuery);
      await entityManager.query(automationQuery);
      await entityManager.query('COMMIT');
    } catch (error) {
      await entityManager.query('ROLLBACK;');
      console.error('Error updating campaigns or automations:', error);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
