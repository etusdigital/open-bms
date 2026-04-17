import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
import { GoogleTasksProvider } from '../../providers/google-tasks.provider';
import { AutomationsService } from '../automations/automations.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { RedisService } from '../../providers/redis.provider';
import { AccountsService } from '../accounts/accounts.service';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { ClsService } from 'nestjs-cls';
import { FieldsType, InterationEmailTypes } from './tags.interface';
import { AccountCacheService } from '../accounts/account-cache.service';
import { SegmentQueryBuilderProvider } from './builder/query-builder.provider';

@Injectable()
export class TagsService {
  private googleTaskName: string;
  private googleTaskEndpoint: string;
  private migrationAccounts = [65, 22, 60, 61];

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
    private readonly googleTasksProvider: GoogleTasksProvider,
    private readonly redisService: RedisService,
    private readonly cls: ClsService,
    private readonly accountCacheService: AccountCacheService,
    private readonly segmentQueryBuilderProvider: SegmentQueryBuilderProvider,
  ) {
    this.googleTaskName = process.env.GOOGLE_TASK_SEGMENT;
    this.googleTaskEndpoint = process.env.TAG_PROCESS_ENDPOINT;
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
    try {
      tagsDto.accountId = accountId ? accountId : this.cls.get('accountId');

      const tag = this.tagsRepository.create(tagsDto);
      const savedTag = await this.tagsRepository.save(tag);

      // Invalidate account cache
      this.accountCacheService.invalidateAccountCacheAsync(savedTag.accountId);

      return savedTag;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Tag with that name already exists');
      }

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
      const generateItems = this.migrationAccounts.includes(this.cls.get('accountId'))
        ? await this.segmentQueryBuilderProvider.generateSegmentQueryV2(tag, segmentDto)
        : await this.generateSegmentQuery(tag, segmentDto);
      const query = generateItems.query;
      const externalQuerySteps = generateItems.externalQuerySteps;
      if (segmentDto.isRealTimeSegment) {
        await this.realtimeUpdate(tag, 'add');
      }

      let currentTime = new Date();
      if (segmentDto.name.includes(' - copy')) {
        currentTime = new Date(currentTime.getTime() + 10 * 60000);
      }

      const response = await this.googleTasksProvider.create(tag.id, currentTime, this.googleTaskEndpoint, this.googleTaskName);

      const updatedTag = await this.update(tag.id, {
        name: segmentDto.name,
        query,
        externalQuerySteps,
        scheduleCloudTaskId: response[0].name,
      });

      // Invalidate account cache (already invalidated in create, but for safety)
      this.accountCacheService.invalidateAccountCacheAsync(tag.accountId);

      return updatedTag;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Segment with that name already exists');
      }

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

      const generateItems = this.migrationAccounts.includes(this.cls.get('accountId'))
        ? await this.segmentQueryBuilderProvider.generateSegmentQueryV2(tag, segmentDto)
        : await this.generateSegmentQuery(tag, segmentDto);
      segmentDto.query = generateItems.query;
      segmentDto.externalQuerySteps = generateItems.externalQuerySteps;

      try {
        await this.googleTasksProvider.delete(tag.scheduleCloudTaskId, this.googleTaskName);
      } catch (error) {
        console.log('Error to delete task', error);
      }

      const currentTime = new Date(new Date().getTime() + 5000);
      const response = await this.googleTasksProvider.create(tag.id, currentTime, this.googleTaskEndpoint, this.googleTaskName);
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
        throw new ForbiddenException('Segment with that name already exists');
      }

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

  async generateSegmentQuery(tag: TagEntity, segmentDto: SegmentDto): Promise<{ query: string; externalQuerySteps: any[] | null }> {
    const account = await this.accountService.findOne(tag.accountId);
    const timeZone = account.configByName('time_zone');

    const externalQuerySteps = [];
    let subQueys = 0;
    let endQuery = '';
    let query = `INSERT INTO segment_process (`;
    for (const steps of segmentDto.steps) {
      let isConditionalCard = false;
      let setConditionalStatus = 0;
      const tagsCard = [];

      for (const step of steps) {
        if (!isConditionalCard) {
          if (step.type === 'conditionalCard') {
            query += ` ${step.value}`;
          }
          query += ` ( SELECT ${tag.id}, ct.id FROM contacts ct
          #PUSH_JOIN_REPLACE#
          WHERE ct.account_id = ${tag.accountId} AND ct.is_active `;
          isConditionalCard = true;
          setConditionalStatus = 1;
        }
        if (step.type == 'tag') {
          tagsCard.push(step);
          continue;
        }

        if (setConditionalStatus == 1 && step.type != 'conditionalCard') {
          query += ` ${step?.conditional ? ` ${step.conditional}` : `AND`} ( `;
          setConditionalStatus = 2;
        } else {
          query += step?.conditional ? ` ${step.conditional}` : ``;
        }

        switch (step.type) {
          case 'interation':
            if (step.event_type === 'anyChannel') {
              const time = `(CURRENT_DATE AT TIME ZONE '${timeZone?.value || 'UTC'}' - interval '${step.time} day')`;
              const joinContactsDevices = 'INNER JOIN contacts_devices ctd ON ctd.contact_id = ct.id AND ctd.account_id = ct.account_id';
              query = query.replace('#PUSH_JOIN_REPLACE#', joinContactsDevices);
              query += ` (ct.last_open_date >= ${time} OR ct.last_click_date >= ${time} OR ct.sms_last_click >= ${time}
                OR ct.whatsapp_last_open >= ${time} OR ct.whatsapp_last_click >= ${time} OR ctd.last_click_date >= ${time}) `;
              break;
            }
            if (step.event_type === 'page_view') {
              const subTableNamePageView = `table_segment_page_view${subQueys}_${tag.id}`;
              const valueFilter = step.page_view_filter === 'iLike' ? `'%${step.page_view_value}%'` : step.page_view_value;
              const conditionalPageView = step.conditional_interation === 'yes' ? 'IN' : 'NOT IN';
              let queryPageViewCH = `SELECT contact_id FROM events_logs_v2 WHERE event = 'page_view'
              AND account_id = ${tag.accountId}
              AND time_date > #REPLACE_TIME_${step.time}_EVENTS_LOGS#
              AND url ${step.page_view_filter} ${valueFilter}`;
              if (step.custom_times_value > 1) {
                queryPageViewCH += ` GROUP BY contact_id
                HAVING COUNT(contact_id) ${step.conditional_times_value} ${parseInt(step.custom_times_value)} `;
              }
              query += ` ct.id ${conditionalPageView} (select contact_id from ${subTableNamePageView})`;
              subQueys++;

              externalQuerySteps.push({
                tableName: subTableNamePageView,
                query: queryPageViewCH,
              });

              break;
            }

            if (step.message === 'any' && (!step.custom_times_value || parseInt(step.custom_times_value) === 1)) {
              let eventFilter = `ct.${step.event}`;
              if (['web-push', 'mobile-push'].includes(step.event_type)) {
                const joinContactsDevices = 'INNER JOIN contacts_devices ctd ON ctd.contact_id = ct.id AND ctd.account_id = ct.account_id';
                query = query.replace('#PUSH_JOIN_REPLACE#', joinContactsDevices);
                eventFilter = `ctd.type = '${step.event_type}' AND ctd.${step.event}`;
              }
              let timeFilter = step.conditional_interation == 'yes' ? 'is not null' : 'is null';
              if (step.time != 'all') {
                timeFilter =
                  step.conditional_interation == 'yes'
                    ? `> (CURRENT_DATE AT TIME ZONE '${timeZone?.value || 'UTC'}' - interval '${step.time} day')`
                    : `< (CURRENT_DATE AT TIME ZONE '${timeZone?.value || 'UTC'}' - interval '${step.time} day') OR ${eventFilter} is null`;
              }
              query += ` (${eventFilter} ${timeFilter})`;
            } else {
              const filterType = step.conditional_interation == 'yes' ? 'IN' : 'NOT IN';
              if (!step.custom_times_value || parseInt(step.custom_times_value) === 1) {
                const subTableNameView = `table_segment_view${subQueys}_${tag.id}`;
                let queryPageView = `SELECT DISTINCT contact_id
                FROM events_logs_v2 
                WHERE account_id = ${tag.accountId}
                AND event = '${this.parseEventType(step.event)}'
                ${step.message ? `AND message_id = ${step.message.id} ${step.conditional_interation != 'yes' ? 'AND contact_id IS NOT NULL' : ''}` : ''}`;
                if (step.time != 'all') {
                  queryPageView += ` AND time_date >= #REPLACE_TIME_${step.time}_EVENTS_LOGS#`;
                }

                query += ` ct.id ${filterType} (select contact_id from ${subTableNameView})`;
                subQueys++;

                externalQuerySteps.push({
                  tableName: subTableNameView,
                  query: queryPageView,
                });
              } else {
                const subTableName = `table_segment${subQueys}_${tag.id}`;
                const clickhouseQuery = `SELECT contact_id FROM events_logs_v2 WHERE event = '${this.parseEventType(step.event)}'
                  AND account_id = ${tag.accountId}
                  AND time_date >= #REPLACE_TIME_${step.time}_EVENTS_LOGS#
                  ${step.message && step.message.id ? ` AND message_id = ${step.message.id} ` : ''}
                  ${step.event_type == 'email' ? ` AND message_type = 'email' ` : ''}
                  ${step.conditional_interation != 'yes' ? ' AND contact_id IS NOT NULL' : ''}
                  GROUP BY contact_id
                  HAVING COUNT(contact_id) ${step.conditional_times_value} ${parseInt(step.custom_times_value)}`;

                externalQuerySteps.push({
                  tableName: subTableName,
                  query: clickhouseQuery,
                });

                endQuery += ` DROP TABLE ${subTableName}; `;
                query += ` ct.id ${filterType} (select contact_id from ${subTableName})`;
                subQueys++;
              }
            }
            break;

          case 'custom_field': {
            let customFieldValue = step.custom_field_value;
            if (step.conditional_custom_field == 'iLike') {
              customFieldValue = `%${step.custom_field_value}%`;
            }
            query += ` ct.id IN ( SELECT contact_id from contacts_custom_fields
              WHERE account_id = ${tag.accountId} AND custom_field_id = ${step.custom_field_id}
              and ${FieldsType[`${step?.custom_field_type || 'text'}`]} ${step.conditional_custom_field} '${customFieldValue.toLowerCase()}'
            )`;
            break;
          }

          case 'user_field':
            if (step.user_field_key === 'created_at_date' || step.user_field_key === 'last_automation_date') {
              if (step.conditional_user_field === '-') {
                query += ` ct.${step.user_field_key} >= (CURRENT_DATE AT TIME ZONE '${timeZone?.value || 'UTC'}' - interval '${step.user_field_value} day')`;
                break;
              }

              const date = new Date(step.user_field_value).toISOString();
              query += ` ${step.user_field_key} ${step.conditional_user_field} '${date}'`;
              break;
            }

            if (step.user_field_key === 'email_provider') {
              query += ` ${step.user_field_key} ${step.conditional_user_field} '${step.user_field_value}'`;
              break;
            }

            if (step.user_field_key === 'is_email_deliverable') {
              if (step.conditional_user_field === 'true') {
                query += ` ct.is_valid AND ct.is_unsubscribed = false AND ct.has_bounced = false`;
                break;
              }

              if (step.conditional_user_field === 'false') {
                query += ` (ct.is_valid = false OR ct.is_unsubscribed = true OR ct.has_bounced = true)`;
                break;
              }
            }

            if (step.user_field_key === 'communication_channels') {
              query += ` ct.${step.user_field_value} = ${step.conditional_user_field}`;
              if (step.user_field_value === 'has_web_push') {
                const joinContactsDevices = 'INNER JOIN contacts_devices ctd on ctd.contact_id = ct.id AND ctd.account_id = ct.account_id';
                query = query.replace('#PUSH_JOIN_REPLACE#', joinContactsDevices);
              } else if (step.user_field_value === 'has_email') {
                query += segmentDto.addBounced ? '' : ' AND NOT ct.has_bounced ';
                query += segmentDto.addInvalid ? '' : ' AND ct.is_valid ';
                query += segmentDto.addUnsubscribed ? '' : ' AND NOT ct.is_unsubscribed';
              }
              break;
            }

            query += ` ${step.user_field_key} ${step.conditional_user_field} '${step.user_field_value.toLowerCase()}'`;

            break;
          case 'custom_event': {
            const subTableNameCustomEvent = `table_segment_custom_event${subQueys}_${tag.id}`;
            let queryCustomEvent = `SELECT contact_id
            FROM events_logs_v2
            WHERE account_id = ${tag.accountId}
            AND event = '${step?.event?.name || 0}'
            AND contact_id IS NOT NULL`;
            if (step.time_type == 'range') {
              queryCustomEvent += ` AND time_date BETWEEN '${step.custom_event_date}' AND '${step.custom_event_date_end}'`;
            } else if (step.time_type == 'date') {
              queryCustomEvent += ` AND time_date ${step.conditional_event_filter} '${step.custom_event_date}'`;
            } else {
              if (['current_week', 'last_week'].includes(step.time)) {
                queryCustomEvent += ` AND time_date BETWEEN #BETWEEN_REPLACE_${step.time},${step.conditional_week_day_filter}_EVENTS_LOGS#`;
              } else {
                queryCustomEvent += ` AND time_date ${step.conditional_event_filter} #REPLACE_TIME_${step.time}_EVENTS_LOGS#`;
              }
            }
            if (step.properties) {
              for (const property of step.properties) {
                queryCustomEvent += ` AND properties.'${property.property}' = '${property.value}'`;
              }
            }
            if (step.custom_times_value) {
              queryCustomEvent += ` GROUP BY contact_id
              HAVING COUNT(contact_id) ${step.conditional_times_value} ${parseInt(step.custom_times_value)} `;
            }

            query += ` ct.id ${step.conditional_event_type} (select contact_id from ${subTableNameCustomEvent})`;
            subQueys++;

            externalQuerySteps.push({
              tableName: subTableNameCustomEvent,
              query: queryCustomEvent,
            });

            break;
          }
          case 'automation_state':
            query += ` ct.id IN (SELECT contact_id
                FROM contacts_automations
                WHERE account_id = ${tag.accountId} `;

            if (step.time == 1) {
              query += `AND created_at_date = (CURRENT_DATE AT TIME ZONE '${timeZone?.value || 'UTC'}' - interval '${step.time} day')::date`;
            } else {
              query += `AND created_at_date >= (CURRENT_DATE AT TIME ZONE '${timeZone?.value || 'UTC'}' - interval '${step.time} day')`;
            }

            if (step.automation) {
              query += ` AND automation_id = ${step.automation.id}`;
            }
            if (step.event !== 'entered') {
              query += ` AND status = '${step.event}'`;
            }
            query += ` GROUP BY contact_id
            HAVING COUNT(contact_id) ${step.conditional_times_value} ${parseInt(step.custom_times_value)} `;
            query += `)`;
            break;
        }
      }
      query = query.replace('#PUSH_JOIN_REPLACE#', '');

      if (setConditionalStatus == 2) {
        query += ` )`;
      }

      for (const stepTag of tagsCard) {
        const conditional = stepTag.conditional_tag == 'in' ? ' INTERSECT ' : ' EXCEPT ';

        query += ` ${conditional} (
          SELECT ${tag.id}, contact_id from contacts_tags
            WHERE account_id = ${tag.accountId} AND is_active AND tag_id IN (${stepTag.tag_id})
         )`;
      }

      query += ` )`;
    }

    if (segmentDto.contactsLimit) {
      query += ` LIMIT ${segmentDto.contactsLimit} `;
    }

    query += ' );';

    if (endQuery) {
      query = `${query} ${endQuery}`;
    }

    return { query, externalQuerySteps: externalQuerySteps.length ? externalQuerySteps : null };
  }

  parseEventType(event) {
    switch (event) {
      case InterationEmailTypes.SEND:
        return 'delivered';
      case InterationEmailTypes.DELIVERED:
        return 'delivered';
      case InterationEmailTypes.OPEN:
        return 'open';
      case InterationEmailTypes.CLICK:
        return 'click';
    }
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
      console.error(error);
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Tag with that name already exists');
      }

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
        await this.googleTasksProvider.delete(tag.scheduleCloudTaskId, this.googleTaskName);
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
      return await this.googleTasksProvider.callRunTask(segment.scheduleCloudTaskId, this.googleTaskName);
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
