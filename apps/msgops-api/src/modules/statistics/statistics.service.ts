import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DashboardStatisticsDto, StatisticsDto } from './dto/statistics.dto';
import { GoogleTasksProvider } from 'src/providers/google-tasks.provider';
import dayjs, { Dayjs } from 'dayjs';
import { AccountsService } from '../accounts/accounts.service';
import { AccountUsageEntity } from 'src/entities/account-usage.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { ContactsService } from '../contacts/contacts.service';
import { PoolsService } from '../pools/pools.service';
import { StatisticsUsageDto } from './dto/statistics-usage.dto';
import { MessagesService } from '../messages/messages.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { AutomationsService } from '../automations/automations.service';
import { EventStatisticsEntity } from 'src/entities/event-statistics.entity';
import { HourlyInsight } from './statistics.interface';
import { RedisService } from '../../providers/redis.provider';
import { Redis } from 'ioredis';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { ClickhouseProvider } from 'src/providers/clickhouse.provider';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

@Injectable()
export class StatisticsService {
  private redisClient: Redis;
  constructor(
    private readonly googleTasksProvider: GoogleTasksProvider,
    private readonly accountService: AccountsService,
    private readonly contactService: ContactsService,
    private readonly automationService: AutomationsService,
    private readonly campaignService: CampaignsService,
    private readonly poolService: PoolsService,
    private readonly messagesService: MessagesService,
    private readonly redisService: RedisService,
    private readonly clickhouseProvider: ClickhouseProvider,

    private readonly cls: ClsService,

    @InjectRepository(AccountUsageEntity)
    private readonly accountUsageRepository: Repository<AccountUsageEntity>,
    @InjectRepository(EventStatisticsEntity)
    private readonly eventStatisticsRepository: Repository<EventStatisticsEntity>,
  ) {
    this.redisClient = this.redisService.getClient();
  }

  async dashboard(params: DashboardStatisticsDto, mcpRequest = false) {
    try {
      if (params.groupItems && !Array.isArray(params.groupItems)) {
        params.groupItems = [params.groupItems];
      }

      const ALLOWED_GROUP_ITEMS = ['date', 'message_id', 'campaign_id', 'automation_id'];
      const groupItems = [];

      if (params.groupByMessage) {
        groupItems.push('message_id');
      }

      if (params.groupByCampaign) {
        groupItems.push('campaign_id');
      }

      if (mcpRequest && params.groupItems && params.groupItems.length > 0) {
        groupItems.push(...params.groupItems.filter((item) => ALLOWED_GROUP_ITEMS.includes(item)));
      } else {
        groupItems.push('date');
      }

      const queryParams: any[] = [this.cls.get('accountId'), params.startDate, params.endDate];
      let paramIndex = 4;
      let filters = '';

      if (params.campaigns) {
        if (params.afterTestAb === 'true') {
          queryParams.push(params.campaigns);
          filters += ` AND es.campaign_id = ANY($${paramIndex}::int[]) AND es.is_test_ab = false`;
          paramIndex++;
        } else if (params.campaigns === 'all') {
          filters += ' AND es.campaign_id IS NOT NULL';
        } else {
          queryParams.push(params.campaigns);
          filters += ` AND es.campaign_id = ANY($${paramIndex}::int[])`;
          paramIndex++;
        }
      }

      if (params.automations) {
        if (params.automations === 'all') {
          filters += ' AND es.automation_id IS NOT NULL';
        } else {
          queryParams.push(params.automations);
          filters += ` AND es.automation_id = ANY($${paramIndex}::int[])`;
          paramIndex++;
        }
      }

      if (params.messages && Array.isArray(params.messages) && params.messages.length > 0) {
        queryParams.push(params.messages);
        filters += ` AND es.message_id = ANY($${paramIndex}::int[])`;
        paramIndex++;
      }

      if (params.segments) {
        const processFilter = await this.filterByTags(params.segments);
        if (!processFilter) return { general: {}, daily: [] };
        filters += processFilter;
      }

      if (params.tags) {
        const processFilter = await this.filterByTags(params.tags);
        if (!processFilter) return { general: {}, daily: [] };
        filters += processFilter;
      }

      if (params.senders) {
        const pools = await this.poolService.getPoolsById(params.senders);
        const poolNames = pools.map((pool) => pool.poolName);
        queryParams.push(poolNames);
        filters += ` AND es.pool = ANY($${paramIndex}::text[])`;
        paramIndex++;
      }

      if (params.subUsers) {
        queryParams.push(params.subUsers);
        filters += ` AND es.provider_account = ANY($${paramIndex}::text[])`;
        paramIndex++;
      }

      const select = `SELECT ${groupItems.map((item) => `es.${item}`).join(', ')}, SUM(es.delivered) delivered, SUM(es.open) open,
        SUM(es.click) click, SUM(es.unsubscribe) unsubscribe, SUM(es.bounce) bounce, SUM(es.blocked) blocked, SUM(es.unique_open) unique_opens, SUM(es.unique_click) unique_clicks
        FROM events_statistics es
        WHERE es.account_id = $1
        AND es.event_type = 'email'
        AND es.date BETWEEN $2 AND $3`;

      const groupBY = `GROUP BY ${groupItems.map((item) => `es.${item}`).join(', ')}`;
      const orderBy = `ORDER BY es.date ASC`;
      const query = `WITH stats as (
          ${select} ${filters} ${groupBY} ${orderBy}
        )
        SELECT ${groupItems.map((item) => `stats.${item}`).join(', ')},
          delivered::integer, open::integer, click::integer, unsubscribe::integer, bounce::integer, blocked::integer, unique_opens::integer, unique_clicks::integer
          FROM generate_series(DATE($2), DATE($3), interval '1 day') as gs(date)
            LEFT JOIN stats ON stats.date = gs.date
            ORDER BY gs.date DESC`;

      let response;
      const currentDate = dayjs();
      const startDate = dayjs(params.startDate);
      if (currentDate.diff(startDate, 'day') <= 31 && Object.keys(params).length === 3 && !mcpRequest) {
        response = await this.getRedisStatistics(params.startDate, params.endDate, 'email');
      } else {
        if ((mcpRequest && !groupItems.includes('date')) || params.groupByCampaign) {
          const rows = await this.eventStatisticsRepository.query(`${select} ${filters} ${groupBY}`, queryParams);
          if (params.groupByCampaign) {
            return this.groupStatsByCampaign(rows);
          }
          return rows;
        }
        response = await this.eventStatisticsRepository.query(query, queryParams);
      }
      if (params.groupByMessage && !mcpRequest) {
        return await this.groupByMessage(response, params.messages);
      }

      const general = this.sumStatistics(response);

      return {
        general: general,
        daily: response,
      };
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getRedisStatistics(startDateParam, endDateParam, eventType) {
    const pipeline = this.redisClient.pipeline();
    const dates = [];
    let startDate = dayjs(startDateParam);
    const endDate = dayjs(endDateParam);
    while (startDate <= endDate) {
      dates.push(startDate.format('YYYY-MM-DD'));
      startDate = startDate.add(1, 'day');
    }
    for (const date of dates) {
      const key = `account_events_statistics:${this.cls.get('accountId')}:${eventType}:${date}`;
      pipeline.hgetall(key);
    }
    const result = await pipeline.exec();
    const defaultObject = {
      open: 0,
      click: 0,
      delivered: 0,
      bounce: 0,
      blocked: 0,
      unsubscribe: 0,
      unique_opens: 0,
      unique_clicks: 0,
      sent: 0,
      close: 0,
    };
    return result.map((item, index) => {
      const keys = Object.keys(item[1]);
      if (keys.length) {
        const finalObject = {};
        keys.forEach((key) => {
          finalObject[key] = item[1][key];
        });
        return { date: dates[index], ...finalObject, unique_opens: finalObject['unique_open'], unique_clicks: finalObject['unique_click'] };
      }
      return { date: dates[index], ...defaultObject };
    });
  }

  async filterByTags(tags: number[]): Promise<string> {
    const campaignsFilter: number[] = [];
    const automationsFilter: number[] = [];
    let filters = '';
    for (const tagId of tags) {
      const campaigns = await this.campaignService.getCampaignsByTag(tagId, 90);
      const automations = await this.automationService.getAutomationsByTag(tagId);
      campaigns.forEach((campaign) => {
        campaignsFilter.push(Number(campaign.id));
      });
      automations.forEach((automation) => {
        automationsFilter.push(Number(automation.id));
      });
    }

    if (automationsFilter.length) {
      filters += ` AND automation_id = ANY(ARRAY[${automationsFilter.join(',')}]::int[])`;
    }
    if (campaignsFilter.length) {
      filters += ` AND campaign_id = ANY(ARRAY[${campaignsFilter.join(',')}]::int[])`;
    }

    return filters;
  }

  async groupByMessage(messages, messagesIds) {
    const messagesObjects = messagesIds.reduce(
      (acc, id) => ((acc[id] = { general: { delivered: 0, open: 0, click: 0, unsubscribe: 0, bounce: 0, blocked: 0, sent: 0, close: 0 }, daily: {} }), acc),
      {},
    );
    for (const message of messages) {
      if (message.message_id) {
        messagesIds.forEach((messageId) => {
          if (!Object.prototype.hasOwnProperty.call(messagesObjects[message.message_id].daily, message.date) && messageId != message.message_id) {
            messagesObjects[messageId].daily[message.date] = { date: message.date, delivered: 0, open: 0, click: 0, unsubscribe: 0, bounce: 0, blocked: 0, sent: 0, close: 0 };
          }
        });
        messagesObjects[message.message_id].daily[message.date] = message;
        messagesObjects[message.message_id].general = this.sumStatisticsValues(messagesObjects[message.message_id].general, message);
      } else {
        messagesIds.forEach((messageId) => {
          messagesObjects[messageId].daily[message.date] = message;
        });
      }
    }
    return messagesObjects;
  }

  async getStatisticsAutomation(params: StatisticsDto, type: string, message_type: string, indexName: string) {
    const ALLOWED_INDEX_NAMES = ['message_id', 'campaign_id', 'automation_id'];
    const ALLOWED_MESSAGE_TYPES = ['email', 'web-push', 'mobile-push'];

    if (!ALLOWED_INDEX_NAMES.includes(indexName)) {
      throw new HttpException('Invalid index name', HttpStatus.BAD_REQUEST);
    }
    if (!ALLOWED_MESSAGE_TYPES.includes(message_type)) {
      throw new HttpException('Invalid message type', HttpStatus.BAD_REQUEST);
    }

    const selectFields = ['mobilePush', 'webPush'].includes(type)
      ? 'SUM(es.sent) sent, SUM(es.close) close'
      : 'SUM(es.open) open, SUM(es.unique_open) unique_open, SUM(es.unique_click) unique_click';

    const queryParams: any[] = [this.cls.get('accountId'), message_type, params.startDate, params.endDate, params[type]];
    const paramIndex = 6;
    let automationFilter = '';

    if (params.automationId) {
      automationFilter = `AND es.automation_id = $${paramIndex}`;
      queryParams.push(params.automationId);
    }

    const query = `SELECT es.${indexName}, SUM(es.delivered) delivered,
    SUM(es.click) click, SUM(es.unsubscribe) unsubscribe, SUM(es.bounce) bounce, SUM(es.blocked) blocked,
    ${selectFields}
    FROM events_statistics es
    WHERE es.account_id = $1
    AND event_type = $2
    AND es.date BETWEEN DATE($3) AND DATE($4)
    AND es.${indexName} = ANY($5::int[])
    ${automationFilter}
    GROUP BY es.${indexName}`;

    const response = await this.eventStatisticsRepository.query(query, queryParams);
    const parseData = {};
    response.forEach((item) => {
      parseData[item[indexName]] = { ...item };
    });
    return parseData;
  }

  async statisticsMessages(params: StatisticsDto) {
    const emailMessages = params.email ? await this.getStatisticsAutomation(params, 'email', 'email', 'message_id') : {};
    const webPushMessages = params.webPush ? await this.getStatisticsAutomation(params, 'webPush', 'web-push', 'message_id') : {};
    const mobilePushMessages = params.mobilePush ? await this.getStatisticsAutomation(params, 'mobilePush', 'mobile-push', 'message_id') : {};
    return { ...emailMessages, ...webPushMessages, ...mobilePushMessages };
  }

  async statisticsByCampaignMessage(params: DashboardStatisticsDto) {
    if (!params.startDate || !params.endDate) {
      throw new HttpException('Start date and end date are required', HttpStatus.BAD_REQUEST);
    }

    const accountId = this.cls.get('accountId');

    const timezoneConfig = await this.accountService.findByAccountConfig(accountId, 'time_zone');
    const timezone = timezoneConfig?.value || 'UTC';

    const queryParams: any[] = [accountId, params.startDate, params.endDate, timezone];
    let paramIndex = queryParams.length + 1;

    let eventTypeFilter = '';
    let campaignFilter = '';
    let messageFilter = '';

    if (params.type) {
      eventTypeFilter = ` AND es.event_type = $${paramIndex}::text`;
      queryParams.push(params.type);
      paramIndex++;
    }

    if (params.campaigns && Array.isArray(params.campaigns) && params.campaigns.length > 0) {
      campaignFilter = ` AND es.campaign_id = ANY($${paramIndex}::int[])`;
      queryParams.push(params.campaigns);
      paramIndex++;
    } else if (typeof params.campaigns === 'string') {
      const campaignId = Number(params.campaigns);
      if (!Number.isNaN(campaignId)) {
        campaignFilter = ` AND es.campaign_id = $${paramIndex}::int`;
        queryParams.push(campaignId);
        paramIndex++;
      }
    }

    if (params.messages && Array.isArray(params.messages) && params.messages.length > 0) {
      messageFilter = ` AND es.message_id = ANY($${paramIndex}::int[])`;
      queryParams.push(params.messages);
    }

    const query = `
      WITH stats as (
        SELECT 
          es.date, 
          es.campaign_id, 
          c.schedule_to as schedule_to_campaign, 
          es.message_id, 
          SUM(es.delivered) delivered, 
          SUM(es.sent) sent, 
          SUM(es.click) click, 
          SUM(es.unsubscribe) unsubscribe, 
          SUM(es.bounce) bounce, 
          SUM(es.close) close
        FROM events_statistics es
        LEFT JOIN campaigns c ON c.id = es.campaign_id
        WHERE es.account_id = $1
          AND es.date BETWEEN DATE($2) AND DATE($3)
          ${eventTypeFilter}
          ${campaignFilter}
          ${messageFilter}
        GROUP BY es.date, es.campaign_id, es.message_id, c.schedule_to
        ORDER BY es.date ASC
      )
      SELECT 
        to_char(stats.date, 'YYYY-MM-DD') as date, 
        stats.campaign_id, 
        to_char(stats.schedule_to_campaign AT TIME ZONE $4, 'YYYY-MM-DD') as schedule_to_campaign_date, 
        to_char(stats.schedule_to_campaign AT TIME ZONE $4, 'HH24:MI:SS') as schedule_to_campaign_hour, 
        stats.message_id, 
        delivered::integer, 
        sent::integer, 
        click::integer, 
        unsubscribe::integer, 
        bounce::integer, 
        close::integer
      FROM generate_series(DATE($2), DATE($3), interval '1 day') as gs(date)
      LEFT JOIN stats ON stats.date = gs.date
      ORDER BY gs.date DESC
    `;

    const response = await this.eventStatisticsRepository.query(query, queryParams);

    return response;
  }

  async pushNotification(params: DashboardStatisticsDto) {
    const eventType = params.type === 'mobile-push' ? 'mobile-push' : 'web-push';
    const queryParams: any[] = [eventType, this.cls.get('accountId'), params.startDate, params.endDate];
    let paramIndex = 5;
    let filters = '';

    const groupItems = [];
    if (params.groupByMessage) {
      groupItems.push('message_id');
    }
    groupItems.push('date');

    if (params.campaigns) {
      queryParams.push(params.campaigns);
      filters += ` AND es.campaign_id = ANY($${paramIndex}::int[])`;
      paramIndex++;
    }

    if (params.messages) {
      queryParams.push(params.messages);
      filters += ` AND es.message_id = ANY($${paramIndex}::int[])`;
      paramIndex++;
    }

    if (params.automations) {
      queryParams.push(params.automations);
      filters += ` AND es.automation_id = ANY($${paramIndex}::int[])`;
      paramIndex++;
    }

    if (params.segments) {
      const processFilter = await this.filterByTags(params.segments);
      if (!processFilter) return { general: {}, daily: [] };
      filters += processFilter;
    }

    if (params.tags) {
      const processFilter = await this.filterByTags(params.tags);
      if (!processFilter) return { general: {}, daily: [] };
      filters += processFilter;
    }

    if (params.senders) {
      const pools = await this.poolService.getPoolsById(params.senders);
      const poolNames = pools.map((pool) => pool.poolName);
      queryParams.push(poolNames);
      filters += ` AND es.pool = ANY($${paramIndex}::text[])`;
      paramIndex++;
    }

    if (params.subUsers) {
      queryParams.push(params.subUsers);
      filters += ` AND es.provider_account = ANY($${paramIndex}::text[])`;
    }

    if (params.groupByCampaign) {
      const selectColumns = `es.campaign_id, SUM(es.delivered) delivered, SUM(es.sent) sent, SUM(es.click) click, SUM(es.unsubscribe) unsubscribe, SUM(es.bounce) bounce, SUM(es.close) close`;
      const select = `SELECT ${selectColumns}
      FROM events_statistics es
      WHERE es.event_type = $1
      AND es.account_id = $2
      AND es.date BETWEEN DATE($3) AND DATE($4)`;
      const rows = await this.eventStatisticsRepository.query(`${select} ${filters} GROUP BY es.campaign_id`, queryParams);
      return this.groupStatsByCampaign(rows);
    }

    const selectColumns = `${groupItems.map((item) => `es.${item}`).join(', ')}, SUM(es.delivered) delivered, SUM(es.sent) sent, SUM(es.click) click, SUM(es.unsubscribe) unsubscribe, SUM(es.bounce) bounce, SUM(es.close) close`;

    const select = `SELECT ${selectColumns}
    FROM events_statistics es
    WHERE es.event_type = $1
    AND es.account_id = $2
    AND es.date BETWEEN DATE($3) AND DATE($4)`;

    const groupBY = `GROUP BY ${groupItems.map((item) => `es.${item}`).join(', ')}`;
    const orderBy = `ORDER BY es.date ASC`;

    const query = `WITH stats as (
      ${select} ${filters} ${groupBY} ${orderBy}
    )
    SELECT ${groupItems.map((item) => `stats.${item}`).join(', ')},
      delivered::integer, sent::integer, click::integer, unsubscribe::integer, bounce::integer, close::integer
      FROM generate_series(DATE($3), DATE($4), interval '1 day') as gs(date)
        LEFT JOIN stats ON stats.date = gs.date
        ORDER BY gs.date DESC`;

    let response;
    const currentDate = dayjs();
    const startDate = dayjs(params.startDate);
    if (currentDate.diff(startDate, 'day') <= 31 && Object.keys(params).length === 3) {
      response = await this.getRedisStatistics(params.startDate, params.endDate, eventType);
    } else {
      response = await this.eventStatisticsRepository.query(query, queryParams);
    }

    if (params.groupByMessage) {
      return await this.groupByMessage(response, params.messages);
    }

    const general = this.sumStatistics(response);

    return {
      general: general,
      daily: response,
    };
  }

  sumStatistics(statistics: any) {
    let data = {
      delivered: 0,
      open: 0,
      click: 0,
      unsubscribe: 0,
      bounce: 0,
      blocked: 0,
      sent: 0,
      close: 0,
      unique_opens: 0,
      unique_clicks: 0,
    };
    statistics.forEach((item) => {
      data = this.sumStatisticsValues(data, item);
    });
    return data;
  }

  sumStatisticsValues(statistic, item) {
    statistic.delivered += Number(item.delivered);
    statistic.open += Number(item?.open || 0);
    statistic.click += Number(item.click);
    statistic.unsubscribe += Number(item.unsubscribe);
    statistic.bounce += Number(item.bounce);
    statistic.blocked += Number(item?.blocked || 0);
    statistic.sent += Number(item?.sent || 0);
    statistic.close += Number(item?.close || 0);
    statistic.unique_opens += Number(item?.unique_opens || 0);
    statistic.unique_clicks += Number(item?.unique_clicks || 0);
    return statistic;
  }

  private groupStatsByCampaign(rows: any[]) {
    const campaigns: Record<number, { general: any }> = {};
    for (const row of rows) {
      const id = row.campaign_id;
      if (!id) continue;
      if (!campaigns[id]) {
        campaigns[id] = {
          general: { delivered: 0, open: 0, click: 0, unsubscribe: 0, bounce: 0, blocked: 0, sent: 0, close: 0, unique_opens: 0, unique_clicks: 0 },
        };
      }
      campaigns[id].general = this.sumStatisticsValues(campaigns[id].general, row);
    }
    return campaigns;
  }

  async findAccountUsage(accountId: number, date: string) {
    const account = await this.accountService.findOne(accountId);

    if (!account) {
      throw new HttpException('Account not exists.', HttpStatus.UNAUTHORIZED);
    }

    const email = await this.getTotalUsage('email', accountId, date, 'delivered');
    const push = await this.getTotalUsage('web-push', accountId, date, 'sent');
    const countContacts = await this.contactService.count(accountId);
    const pools = await this.messagesService.getPools(accountId);
    const countIps = await this.poolService.poolsIpsCount(pools, accountId);
    const countVerify = await this.getVerifyUsage(accountId, date);

    await this.accountUsageRepository
      .createQueryBuilder('accounts_usages')
      .insert()
      .values([
        {
          accountId,
          service: 'EMAIL',
          date,
          count: email?.total || 0,
        },
        {
          accountId,
          service: 'WEB_PUSH',
          date,
          count: push?.total || 0,
        },
        {
          accountId,
          service: 'COUNT_CONTACTS',
          date,
          count: countContacts || 0,
        },
        {
          accountId,
          service: 'COUNT_IPS',
          date,
          count: countIps || 0,
        },
        {
          accountId,
          service: 'COUNT_VERIFY',
          date,
          count: countVerify?.total || 0,
        },
      ])
      .orIgnore()
      .execute();

    const minute = Math.floor(Math.random() * (40 - 1 + 1) + 1);
    const dateSchedule = dayjs().tz('America/Sao_Paulo').add(24, 'hour').set('minute', minute).format('YYYY-MM-DD HH:mm:ss');
    const currentDate = dayjs().tz('America/Sao_Paulo').format('YYYY-MM-DD');
    await this.googleTasksProvider.create(
      `${accountId}/${currentDate}`,
      new Date(dateSchedule),
      `${process.env.BRIUS_HOSTURL}/statistics/usage`,
      process.env.GOOGLE_TASK_BMS_USAGE,
    );
    return;
  }

  async getTotalUsage(message_type: string, accountId: number, date: string, key: string) {
    const ALLOWED_KEYS = ['delivered', 'sent'];
    if (!ALLOWED_KEYS.includes(key)) {
      throw new HttpException('Invalid usage key', HttpStatus.BAD_REQUEST);
    }

    const query = `SELECT SUM(es.${key}) as total
    FROM events_statistics es
    WHERE es.event_type = $1
    AND es.account_id = $2 AND date = DATE($3)`;

    const response = await this.eventStatisticsRepository.query(query, [message_type, accountId, date]);
    return response.length ? response[0] : {};
  }

  async getVerifyUsage(accountId: number, date: string) {
    const query = `SELECT SUM(count_total) as total
    FROM verify_statistics
    WHERE date = $1 AND account_id = $2`;

    const response = await this.eventStatisticsRepository.query(query, [date, accountId]);
    return response.length ? response[0] : {};
  }

  async getBfpAccountUsage(params: StatisticsUsageDto, bfpAccountId: string) {
    if (!bfpAccountId || typeof bfpAccountId !== 'string' || !bfpAccountId.trim()) {
      throw new HttpException('Missing bfp-account-id header', HttpStatus.BAD_REQUEST);
    }
    const accounts = await this.accountService.findAccountsByConfig('bfp_account_id', bfpAccountId.trim());
    if (!accounts.length) {
      throw new HttpException('ACCOUNT NOT FOUND', HttpStatus.NOT_FOUND);
    }
    const accountIds = accounts.map((item) => Number(item.accountId));
    return await this.getAccountUsage(params, accountIds, accounts[0].accountId);
  }

  async getAccountUsage(params: StatisticsUsageDto, accountIds?: number[], _firstAccountId?: number) {
    const ids = accountIds && accountIds.length ? accountIds : [Number(this.cls.get('accountId'))];

    // Query usage per account (not yet aggregated across accounts)
    const perAccountQuery = `
    SELECT account_id, to_char(date, 'YYYY-MM') as date, service,
      SUM(count) as quantity,
      MAX(CASE
          WHEN service = 'COUNT_CONTACTS' THEN count
          WHEN service = 'COUNT_IPS' THEN count
          ELSE 0
      END) as max_count
    FROM "accounts_usages"
    WHERE account_id = ANY($1::int[]) AND to_char(date, 'YYYY-MM') = $2
    GROUP BY account_id, to_char(date, 'YYYY-MM'), service
    `;
    const entityManager = this.accountUsageRepository.manager;
    const perAccountUsage = await entityManager.query(perAccountQuery, [ids, params.month]);

    // Load cost configs for all queried accounts
    const accounts = await Promise.all(ids.map((id) => this.accountService.findOne(id)));
    const costConfigsByAccountId = new Map<number, any[]>();
    for (const acc of accounts) {
      const costConfig = acc.configByName('account_costs');
      if (costConfig) {
        costConfigsByAccountId.set(acc.id, JSON.parse(costConfig.value));
      }
    }

    // Apply each account's own cost config, then aggregate across accounts
    const aggregated = new Map<string, { date: string; service: string; quantity: number; cost: number }>();

    for (const row of perAccountUsage) {
      const quantity = Number(row.max_count) > 0 ? Number(row.max_count) : Number(row.quantity);
      const key = `${row.date}:${row.service}`;

      if (!aggregated.has(key)) {
        aggregated.set(key, { date: row.date, service: row.service, quantity: 0, cost: 0 });
      }
      const agg = aggregated.get(key);
      agg.quantity += quantity;

      const accountCosts = costConfigsByAccountId.get(Number(row.account_id));
      if (accountCosts) {
        const costItem = accountCosts.find((item) => item.name === row.service);
        if (costItem) {
          const unitCost = costItem.unitCost + (costItem.unitCost * costItem.margin) / 100;
          agg.cost += unitCost * quantity;
        }
      }
    }

    // Format output to match existing response shape
    return Array.from(aggregated.values()).map((item) => {
      const totalQuantity = item.quantity;
      const totalCost = item.cost;
      return {
        date: item.date,
        service: item.service,
        quantity: String(totalQuantity),
        unitCost: totalQuantity > 0 && totalCost > 0 ? parseFloat((totalCost / totalQuantity).toFixed(6)) : 0,
        cost: totalCost > 0 ? totalCost.toFixed(2) : 0,
      };
    });
  }

  async getMonthUsage() {
    const isSuperAdmin = this.cls.get('isSuperAdmin');

    let query = this.accountUsageRepository.createQueryBuilder().select(`DISTINCT to_char(date, 'YYYY-MM') as month`).orderBy(`to_char(date, 'YYYY-MM')`, 'DESC');

    if (!isSuperAdmin) {
      query = query.where('account_id = :accountId', { accountId: this.cls.get('accountId') });
    }

    const result = await query.getRawMany();
    return result.map((r) => r.month);
  }

  async getCampaignStatistics(campaignId, date) {
    const query = `SELECT es.date, SUM(es.delivered) delivered, SUM(es.open) open,
        SUM(es.click) click, SUM(es.unsubscribe) unsubscribe, SUM(es.bounce) bounce, SUM(es.blocked) blocked
        FROM events_statistics es
        WHERE es.event_type = 'email'
        AND es.date = DATE($1)
        AND es.campaign_id = $2
        GROUP BY es.date`;

    return await this.eventStatisticsRepository.query(query, [date, campaignId]);
  }

  async getAutomationStatistics(automationId) {
    const safeAccountId = Number(this.cls.get('accountId'));
    const safeAutomationId = Number(automationId);

    const resultCH = await this.clickhouseProvider.runQuery(`
        select
        count(distinct case when event = 'open' then contact_id end) unique_open,
        count(distinct case when event = 'click' then contact_id end) unique_click
        from events_logs_v2 where time_date >= '${dayjs().format('YYYY-MM-DD')}' and event IN ('open', 'click')
        and account_id = ${safeAccountId} and automation_id = ${safeAutomationId}
    `);
    const dataCH = resultCH[0];
    const uniqueOpen = Number(dataCH?.unique_open || 0);
    const uniqueClick = Number(dataCH?.unique_click || 0);

    const query = `
      select *
      from
      (
        select
        count(case when status = 'running' then 1 end) as total_running,
        count(DISTINCT case when date(created_at) = current_date then contact_id end) as total_running_today,
        $3 as unique_open,
        $4 as unique_click
        from contacts_automations where account_id = $1 and automation_id = $2
        and created_at_date >= CURRENT_DATE - interval '15 day'
      ) as t2
    `;

    return await this.eventStatisticsRepository.query(query, [safeAccountId, safeAutomationId, uniqueOpen, uniqueClick]);
  }

  async leads(params: StatisticsDto) {
    const ALLOWED_GROUP_ITEMS = [
      'lead_source',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_keyword',
      'utm_term',
      'country',
      'status',
      'email_provider',
      'source_url',
      'direct_to_url',
      'tag_name',
      'ad_id',
      'adgroup_id',
      'adset_id',
      'campaign_id',
      'placement',
      'engaged',
      'created_at_date',
    ];
    const ALLOWED_SEARCH_COLUMNS = ['lead_source', 'status', 'automation_status', 'utm_source', 'utm_medium', 'utm_campaign', 'email_provider', 'source_url'];

    let safeGroupItems = '';
    if (params.groupItems) {
      const validItems = params.groupItems.filter((item) => ALLOWED_GROUP_ITEMS.includes(item));
      safeGroupItems = validItems.join(',');
    }

    const queryParams: any[] = [this.cls.get('accountId'), params.startDate, params.endDate];
    let paramIndex = 4;
    let searchFilter = '';

    if (params.search) {
      const items = params.search.toString().split(',');
      const grouped = items.reduce<Record<string, string[]>>((acc, item) => {
        const colonIndex = item.indexOf(':');
        if (colonIndex === -1) return acc;
        const key = item.slice(0, colonIndex);
        const value = item.slice(colonIndex + 1);
        if (ALLOWED_SEARCH_COLUMNS.includes(key)) {
          if (!acc[key]) acc[key] = [];
          acc[key].push(value);
        }
        return acc;
      }, {});

      const andClauses = Object.keys(grouped).map((key) => {
        const orClauses = grouped[key].map((val) => {
          queryParams.push(val);
          return `${key} = $${paramIndex++}`;
        });
        return `(${orClauses.join(' OR ')})`;
      });

      if (andClauses.length > 0) {
        searchFilter = `AND ${andClauses.join(' AND ')}`;
      }
    }

    const query = `
      WITH lds AS (
        SELECT l.*,
        ROW_NUMBER() OVER (
          PARTITION BY contact_id
          ORDER BY id
        ) AS rn
        FROM leads l
        WHERE account_id = $1
        AND lead_source IN ('quizmaker', 'quizmaker-new')
        AND created_at_date BETWEEN $2 AND $3
        ${searchFilter}
      )

      SELECT
      COUNT(*) AS total,
      SUM (CASE WHEN rn = 1 THEN 1 ELSE 0 END) AS total_unique,
      SUM (CASE WHEN rn = 1 and is_valid THEN 1 ELSE 0 END) AS valid,
      SUM (CASE WHEN rn = 1 and status = 'new' THEN 1 ELSE 0 END) AS new,
      SUM (CASE WHEN rn = 1 and status = 'old' THEN 1 ELSE 0 END) AS old,
      SUM (CASE WHEN rn = 1 and status = 'bounced' THEN 1 ELSE 0 END) AS bounced,
      SUM (CASE WHEN rn = 1 and is_valid = false THEN 1 ELSE 0 END) AS invalid,
      SUM (CASE WHEN rn = 1 and automation_status = 'started' THEN 1 ELSE 0 END) AS automation_entry,
      SUM (CASE WHEN rn = 1 and automation_status = 'duplicate' THEN 1 ELSE 0 END) AS automation_duplicated
      ${safeGroupItems ? `,${safeGroupItems}` : ''}
      FROM lds
      ${safeGroupItems ? `GROUP BY ${safeGroupItems}` : ''}
    `;

    const entityManager = this.accountUsageRepository.manager;
    const leads = await entityManager.query(query, queryParams);
    return this.formatedLeads(leads);
  }

  formatedLeads(leads) {
    for (const lead of leads) {
      lead.total_unique = `${lead.total_unique} (${((lead.total_unique / lead.total) * 100 || 0).toFixed(1)}%)`;
      lead.valid = `${lead.valid} (${((lead.valid / lead.total) * 100 || 0).toFixed(1)}%)`;
      lead.new = `${lead.new} (${((lead.new / lead.total) * 100 || 0).toFixed(1)}%)`;
      lead.old = `${lead.old} (${((lead.old / lead.total) * 100 || 0).toFixed(1)}%)`;
      lead.bounced = `${lead.bounced} (${((lead.bounced / lead.total) * 100 || 0).toFixed(1)}%)`;
      lead.invalid = `${lead.invalid} (${((lead.invalid / lead.total) * 100 || 0).toFixed(1)}%)`;
      lead.automation_entry = `${lead.automation_entry} (${((lead.automation_entry / lead.total) * 100 || 0).toFixed(1)}%)`;
      lead.automation_duplicated = `${lead.automation_duplicated} (${((lead.automation_duplicated / lead.total) * 100 || 0).toFixed(1)}%)`;
    }

    return leads;
  }

  async statisticsCustomEvents(customEventId: number, startDate: string, endDate: string) {
    const query = `SELECT * FROM events_statistics
      WHERE account_id = $1
        AND event_id = $2
        AND date BETWEEN $3 AND $4`;
    return this.eventStatisticsRepository.query(query, [this.cls.get('accountId'), customEventId, startDate, endDate]);
  }

  async exportDataToRedis() {
    const query = `select
    account_id, date, event_type, SUM(delivered) delivered, SUM(open) open, SUM(click) click,
    SUM(unsubscribe) unsubscribe, SUM(bounce) bounce, SUM(blocked) blocked, SUM(unique_open) unique_opens,
    SUM(unique_click) unique_clicks, SUM(sent) sent, SUM(close) close
    from events_statistics
    where date > CURRENT_DATE - interval '32 day'
    group by account_id, date, event_type`;

    const entityManager = this.accountUsageRepository.manager;
    const events = await entityManager.query(query);

    const pipeline = this.redisClient.pipeline();
    for (const event of events) {
      const key = `account_events_statistics:${event.account_id}:${event.event_type}:${dayjs(event.date).format('YYYY-MM-DD')}`;
      const statistics = {
        open: event.open,
        click: event.click,
        delivered: event.delivered,
        bounce: event.bounce,
        blocked: event.blocked,
        unsubscribe: event.unsubscribe,
        unique_open: event.unique_opens,
        unique_click: event.unique_clicks,
        sent: event.sent,
        close: event.close,
      };
      pipeline.hset(key, statistics);
    }

    try {
      await pipeline.exec();
    } catch (error) {
      console.error(`Unable to save in Redis. ${error}`);
    }
  }

  /**
   * Retrieves hourly insights data for email events
   *
   * This method fetches email statistics from Redis for the current day and previous day,
   * then transforms the hourly data into a structured format for analysis.
   *
   * - Gets account timezone configuration
   * - Retrieves today's and yesterday's email statistics from Redis
   * - Extracts and formats hourly event data (opens, clicks, etc.)
   * - Returns data organized by date with hourly breakdowns
   */
  async insights(period: string): Promise<HourlyInsight[]> {
    const account = await this.accountService.findOne(this.cls.get('accountId'));
    const timezone = account.configByName('time_zone').value;
    const now = dayjs().tz(timezone);

    let startDate: Dayjs;
    let endDate: Dayjs;

    switch (period) {
      case 'last48':
        startDate = now.subtract(1, 'day').startOf('day');
        endDate = now.endOf('day');
        break;
      case 'last7':
        startDate = now.subtract(7, 'day').startOf('day');
        endDate = now.endOf('day');
        break;
      default:
        startDate = now.subtract(1, 'day').startOf('day');
        endDate = now.endOf('day');
    }

    const pipeline = this.redisClient.pipeline();
    const days = [];
    let currentDate = startDate;

    while (currentDate.isSameOrBefore(endDate, 'day')) {
      pipeline.hgetall(`account_events_statistics:${account.id}:email:${currentDate.format('YYYY-MM-DD')}`);
      days.push(currentDate.format('YYYY-MM-DD'));
      currentDate = currentDate.add(1, 'day');
    }

    const results = await pipeline.exec();

    const transformHourlyData = (data: Record<string, string>) => {
      if (!data) return {};

      const hourlyEvents = {};
      Object.keys(data).forEach((key) => {
        if (key.startsWith('hourly_')) {
          const [, eventName, hour] = key.split(/[_:]/);
          if (!hourlyEvents[eventName]) {
            hourlyEvents[eventName] = {};
          }
          hourlyEvents[eventName][hour] = parseInt(data[key]);
        }
      });

      return hourlyEvents;
    };

    return days.map((day, index) => ({
      date: day,
      ...transformHourlyData(results[index][1] as Record<string, string>),
    }));
  }
}
