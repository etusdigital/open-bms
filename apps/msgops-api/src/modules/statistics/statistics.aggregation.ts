import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { EventStatisticsEntity } from 'src/entities/event-statistics.entity';
import { RedisStatistics } from './statistics.interface';
import { AggregatedData } from './statistics.interface';
import { RedisService } from '../../providers/redis.provider';
import { Redis } from 'ioredis';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class StatisticsAggregationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StatisticsAggregationService.name);
  private readonly redisClient: Redis;
  private aggregationTimer: NodeJS.Timeout | null = null;
  private aggregationRunning = false;
  private lastCleanupDay: string | null = null;

  constructor(
    private readonly accountService: AccountsService,
    private readonly redisService: RedisService,

    @InjectRepository(EventStatisticsEntity)
    private readonly eventStatisticsRepository: Repository<EventStatisticsEntity>,
  ) {
    this.redisClient = this.redisService.getClient();
  }

  // Flushes Redis counters into events_statistics on a fixed interval.
  // Override via STATISTICS_AGGREGATION_INTERVAL_MS; set to 0 to disable.
  onModuleInit(): void {
    // Treat empty string as "unset" so a blank line in .env doesn't silently
    // disable the scheduler (Number("") === 0 would otherwise hit the off branch).
    const raw = process.env.STATISTICS_AGGREGATION_INTERVAL_MS;
    const isProvided = raw != null && raw.trim() !== '';
    const interval = isProvided ? Number(raw) : 60_000;
    if (!Number.isFinite(interval) || interval <= 0) {
      this.logger.log('In-process aggregation scheduler disabled (STATISTICS_AGGREGATION_INTERVAL_MS=0)');
      return;
    }
    this.logger.log(`In-process aggregation scheduler enabled — every ${interval}ms`);
    this.aggregationTimer = setInterval(() => void this.runAggregationCycle(), interval);
    // Don't keep the event loop alive solely for this timer — a graceful
    // shutdown should be able to exit even if a tick is queued.
    this.aggregationTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
  }

  // Shared entry point for the scheduler and the /aggregated-statistics HTTP
  // endpoint. The re-entrancy guard lives here (not just inside the timer)
  // so an external trigger cannot race a concurrent in-process tick and
  // double-write the same rows.
  async runAggregationCycle(): Promise<void> {
    if (this.aggregationRunning) {
      return;
    }
    this.aggregationRunning = true;
    try {
      await this.transferRedisDataToPostgres();
      await this.runDailyCleanupIfDue();
    } catch (err) {
      this.logger.error(`Scheduled aggregation cycle failed: ${(err as Error)?.message ?? err}`);
    } finally {
      this.aggregationRunning = false;
    }
  }

  // Runs removeOldDataFromRedis once per UTC day. Previously triggered by an
  // external Cloud Scheduler daily job; now folded into the in-process loop
  // so OSS deploys don't need a separate scheduler.
  private async runDailyCleanupIfDue(): Promise<void> {
    const today = dayjs.utc().format('YYYY-MM-DD');
    if (this.lastCleanupDay === today) return;
    try {
      await this.removeOldDataFromRedis();
      this.lastCleanupDay = today;
    } catch (err) {
      this.logger.error(`Daily Redis cleanup failed: ${(err as Error)?.message ?? err}`);
    }
  }

  /**
   * Transfers statistics data from Redis to PostgreSQL for all active accounts
   * - Processes data for multiple platforms (email, web-push, mobile-push, etc.)
   * - Uses transactions to ensure data consistency
   * - Batches inserts for better performance
   * - Handles unique opens/clicks aggregation
   * - Manages test A/B campaign data
   * @returns {Promise<void>}
   */
  async transferRedisDataToPostgres(date = null): Promise<void> {
    const accounts = await this.accountService.getActiveAccountIds();

    for (const account of accounts) {
      const platforms = ['email', 'web-push', 'mobile-push', 'sms', 'whatsapp'];
      const currentDate = date ? date : dayjs().subtract(15, 'minute').tz(account.time_zone).format('YYYY-MM-DD');

      const queryRunner = this.eventStatisticsRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // TODO: remove this delete after returning with the unique constraint and move to the upsert
        const deleteQuery = `DELETE FROM events_statistics WHERE account_id = ${account.id} AND date = '${currentDate}'`;
        await queryRunner.manager.query(deleteQuery);

        for (const platform of platforms) {
          const dailyListKey = `statistics_processed_messages:${account.id}:${currentDate}:${platform}`;
          const processedMessages = await this.redisClient.smembers(dailyListKey);

          const globalAccountStatisticsKey = `account_events_statistics:${account.id}:${platform}:${currentDate}`;
          let globalAccountUniqueOpen = 0;
          let globalAccountUniqueClick = 0;

          // Extract unique contacts for delivered, open, click, unsubscribe, bounce, blocked
          const eventsToTrackUnique = ['delivered', 'open', 'click', 'unsubscribe', 'bounce', 'blocked'];
          const uniqueCountsPipeline = this.redisClient.pipeline();

          // Get counts for all unique event types
          for (const eventType of eventsToTrackUnique) {
            const globalUniqueKey = `account_events_unique:${account.id}:${platform}:${currentDate}:${eventType}`;
            uniqueCountsPipeline.scard(globalUniqueKey);

            // Get hourly counts for all unique event types
            for (let hour = 0; hour < 24; hour++) {
              const hourStr = hour.toString().padStart(2, '0');
              const hourlyUniqueKey = `account_events_unique:${account.id}:${platform}:${currentDate}:hourly:${hourStr}:${eventType}`;
              uniqueCountsPipeline.scard(hourlyUniqueKey);
            }
          }
          uniqueCountsPipeline.sunionstore(
            `account_events_unique:${account.id}:${platform}:${currentDate}:unique_counts`,
            `account_events_unique:${account.id}:${platform}:${currentDate}:click`,
            `account_events_unique:${account.id}:${platform}:${currentDate}:open`,
          );
          uniqueCountsPipeline.scard(`account_events_unique:${account.id}:${platform}:${currentDate}:unique_counts`);
          uniqueCountsPipeline.del(`account_events_unique:${account.id}:${platform}:${currentDate}:unique_counts`);

          const uniqueCountsResults = await uniqueCountsPipeline.exec();

          // Batch Redis operations
          const pipeline = this.redisClient.pipeline();
          const messagePromises = processedMessages.map((message) => {
            const [messageType, eventId, messageId, providerAccount, testAb] = message.split(':');
            const isTestAb = testAb === 'testab' || providerAccount === 'testab';
            const providerAccountKey = providerAccount && providerAccount !== 'testab' ? `:${providerAccount}` : '';
            const testAbKey = isTestAb ? ':testab' : '';
            const statisticsKey = `statistics:${account.id}:${currentDate}:${platform}:${messageType}:${eventId}:${messageId}${providerAccountKey}${testAbKey}`;
            const uniqueOpenKey = `statistics_unique:${account.id}:${currentDate}:${platform}:${messageType}:${eventId}:${messageId}${providerAccountKey}${testAbKey}:open`;
            const uniqueClickKey = `statistics_unique:${account.id}:${currentDate}:${platform}:${messageType}:${eventId}:${messageId}${providerAccountKey}${testAbKey}:click`;

            pipeline.hgetall(statisticsKey);
            pipeline.scard(uniqueOpenKey);
            pipeline.scard(uniqueClickKey);

            return {
              messageType,
              eventId,
              messageId,
              isTestAb,
            };
          });

          const results = await pipeline.exec();

          // Process results in batches
          const batchSize = 100;
          const batches = [];

          for (let i = 0; i < processedMessages.length; i++) {
            const messageInfo = messagePromises[i];
            const startIdx = i * 3; // Each message has 3 Redis keys/commands

            const statistics = results[startIdx][1] as any;
            statistics.unique_open = results[startIdx + 1][1] || 0;
            statistics.unique_click = results[startIdx + 2][1] || 0;

            globalAccountUniqueOpen += parseInt(statistics.unique_open || '0');
            globalAccountUniqueClick += parseInt(statistics.unique_click || '0');

            const aggregatedData = this.aggregateRedisData(statistics, messageInfo.isTestAb);

            if (platform !== 'custom-event' && parseInt(messageInfo.messageId) > 2147483647) {
              messageInfo.messageId = '0';
            }

            batches.push({
              date: currentDate,
              accountId: account.id,
              eventType: platform,
              type: messageInfo.messageType,
              messageId: platform !== 'custom-event' ? parseInt(messageInfo.messageId) : null,
              automationId: messageInfo.messageType === 'automation' ? parseInt(messageInfo.eventId) : null,
              campaignId: messageInfo.messageType === 'campaign' ? parseInt(messageInfo.eventId) : null,
              isTestAb: messageInfo.isTestAb,
              eventId: platform === 'custom-event' ? parseInt(messageInfo.eventId) : null,
              pool: statistics.pool,
              utmCampaign: statistics.utm_campaign,
              providerAccount: statistics.provider_account,
              provider: platform === 'email' ? 'sendgrid' : '',
              data: aggregatedData,
            });

            if (batches.length === batchSize || i === processedMessages.length - 1) {
              await this.batchUpsertEventStatistics(batches, queryRunner, date);
              batches.length = 0;
            }
          }

          // Add both existing and new unique counts to the global account statistics
          const globalStatUpdatePipeline = this.redisClient.pipeline();
          globalStatUpdatePipeline.hset(globalAccountStatisticsKey, 'unique_open', globalAccountUniqueOpen);
          globalStatUpdatePipeline.hset(globalAccountStatisticsKey, 'unique_click', globalAccountUniqueClick);

          let total_delivered = 0;

          // Add the new unique counts for other events
          for (let i = 0; i < eventsToTrackUnique.length; i++) {
            const resultIdx = i * 25;
            const eventType = eventsToTrackUnique[i];
            const uniqueCount = (uniqueCountsResults[resultIdx][1] as number) || 0;
            globalStatUpdatePipeline.hset(globalAccountStatisticsKey, `unique_user_${eventType}`, uniqueCount);
            if (eventType === 'delivered') {
              total_delivered = uniqueCount;
            }

            for (let hour = 0; hour < 24; hour++) {
              const hourStr = hour.toString().padStart(2, '0');
              // The hourly data for each event type follows immediately after its daily count
              // So for event type at index i, hourly data starts at (i*25 + 1) and runs for 24 entries
              const hourlyResultIdx = i * 25 + 1 + hour;
              const uniqueCount = uniqueCountsResults[hourlyResultIdx] ? (uniqueCountsResults[hourlyResultIdx][1] as number) || 0 : 0;
              globalStatUpdatePipeline.hset(globalAccountStatisticsKey, `hourly:${hourStr}:unique_user_${eventType}`, uniqueCount);
            }
          }

          const uniqueUserEngagement = (uniqueCountsResults[uniqueCountsResults.length - 2][1] as number) || 0;
          globalStatUpdatePipeline.hset(globalAccountStatisticsKey, 'unique_user_engagement', uniqueUserEngagement);
          if (total_delivered > 0) {
            globalStatUpdatePipeline.hset(globalAccountStatisticsKey, 'user_engagement_rate', ((uniqueUserEngagement / total_delivered) * 100).toFixed(2));
          }

          // Calculate rates and averages for global account statistics
          // First, get current totals from Redis for delivered, opens and clicks
          const globalStats = await this.redisClient.hgetall(globalAccountStatisticsKey);

          // Extract values
          const delivered = parseInt(globalStats['delivered'] || '0');
          const opens = parseInt(globalStats['open'] || '0');
          const clicks = parseInt(globalStats['click'] || '0');
          const uniqueOpens = parseInt(globalStats['unique_user_open'] || '0');
          const uniqueClicks = parseInt(globalStats['unique_user_click'] || '0');

          // Calculate rates and averages
          const openRate = delivered > 0 ? (opens / delivered) * 100 : 0;
          const clickRate = delivered > 0 ? (clicks / delivered) * 100 : 0;
          const clickToOpenRate = opens > 0 ? (clicks / opens) * 100 : 0;
          const opensPerContact = uniqueOpens > 0 ? opens / uniqueOpens : 0;
          const clicksPerContact = uniqueClicks > 0 ? clicks / uniqueClicks : 0;

          // Add rates and averages to the pipeline
          globalStatUpdatePipeline.hset(globalAccountStatisticsKey, 'open_rate', openRate.toFixed(2));
          globalStatUpdatePipeline.hset(globalAccountStatisticsKey, 'click_rate', clickRate.toFixed(2));
          globalStatUpdatePipeline.hset(globalAccountStatisticsKey, 'click_to_open_rate', clickToOpenRate.toFixed(2));
          globalStatUpdatePipeline.hset(globalAccountStatisticsKey, 'opens_per_contact', opensPerContact.toFixed(2));
          globalStatUpdatePipeline.hset(globalAccountStatisticsKey, 'clicks_per_contact', clicksPerContact.toFixed(2));

          await globalStatUpdatePipeline.exec();
        }

        await queryRunner.commitTransaction();
      } catch (e) {
        await queryRunner.rollbackTransaction();
        throw e;
      } finally {
        await queryRunner.release();
      }
    }
  }

  async batchUpsertEventStatistics(
    records: Array<{
      date: string;
      accountId: number;
      eventType: string;
      type: string;
      messageId: number;
      automationId: number;
      campaignId: number;
      isTestAb: boolean;
      eventId: number;
      pool: string;
      provider: string;
      providerAccount: string;
      utmCampaign: string;
      data: AggregatedData;
    }>,
    queryRunner: QueryRunner,
    date: string,
  ): Promise<void> {
    const valuesIndex = records
      .map((_, index) => {
        const offset = index * 37; // 37 is the number of columns in the events_statistics table
        return `($${1 + offset}, $${2 + offset}, $${3 + offset}, $${4 + offset}, $${5 + offset}, $${6 + offset},
                $${7 + offset}, $${8 + offset}, $${9 + offset}, $${10 + offset}, $${11 + offset}, $${12 + offset},
                $${13 + offset}, $${14 + offset}, $${15 + offset}, $${16 + offset}, $${17 + offset}, $${18 + offset},
                $${19 + offset}, $${20 + offset}, $${21 + offset}, $${22 + offset}, $${23 + offset}, $${24 + offset},
                $${25 + offset}, $${26 + offset}, $${27 + offset}, $${28 + offset}, $${29 + offset}, $${30 + offset},
                $${31 + offset}, $${32 + offset}, $${33 + offset}, $${34 + offset}, $${35 + offset},
                $${36 + offset}, $${37 + offset})`;
      })
      .join(',');

    const parameters = records.flatMap((record) => [
      record.date,
      record.accountId,
      record.eventType,
      record.type,
      // Schema enforces NOT NULL on these FK columns; the upstream record
      // builder uses null to mean "this row is not for an automation/campaign
      // /custom-event". Coerce to 0 here so a single insert path satisfies the
      // schema without rewriting every call site, and so the unique-constraint
      // logic (NULLS DISTINCT default) doesn't accidentally allow duplicates.
      record.messageId ?? 0,
      record.automationId ?? 0,
      record.campaignId ?? 0,
      record.isTestAb || false,
      record.eventId ?? 0,
      record.pool ?? '',
      record.provider ?? '',
      record.providerAccount ?? '',
      record.utmCampaign ?? '',
      record.data.processed,
      record.data.delivered,
      record.data.open,
      record.data.unique_open,
      record.data.click,
      record.data.unique_click,
      record.data.bounce,
      record.data.blocked,
      record.data.bot_click,
      record.data.datacenter_click,
      record.data.spam_report,
      record.data.unsubscribe,
      record.data.deferred,
      record.data.sent,
      record.data.close,
      JSON.stringify(record.data.click_position_data),
      JSON.stringify(record.data.email_provider_data),
      JSON.stringify(record.data.browser_data),
      JSON.stringify(record.data.os_data),
      JSON.stringify(record.data.device_data),
      JSON.stringify(record.data.country_data),
      JSON.stringify(record.data.region_data),
    ]);

    const upsertQuery = `
        INSERT INTO events_statistics (
          date, account_id, event_type, type, message_id, automation_id, campaign_id, is_test_ab, event_id, pool, provider, provider_account, utm_campaign,
          processed, delivered, open, unique_open, click, unique_click, bounce, blocked, bot_click, datacenter_click, spam_report, unsubscribe, deferred, sent, close,
          click_position, email_provider, browser, os, device, country, region
        ) VALUES ${valuesIndex}`;

    if (date) {
      console.log(parameters);
    }

    // ON CONFLICT (account_id, date, event_type, type, event_id, message_id, automation_id, campaign_id, is_test_ab)
    // DO UPDATE SET
    //   processed = EXCLUDED.processed,
    //   delivered = EXCLUDED.delivered,
    //   open = EXCLUDED.open,
    //   unique_open = EXCLUDED.unique_open,
    //   click = EXCLUDED.unique_click,
    //   bounce = EXCLUDED.bounce,
    //   spam_report = EXCLUDED.spam_report,
    //   unsubscribe = EXCLUDED.unsubscribe,
    //   deferred = EXCLUDED.deferred,
    //   sent = EXCLUDED.sent,
    //   close = EXCLUDED.close,
    //   click_position = EXCLUDED.click_position,
    //   email_provider = EXCLUDED.email_provider,
    //   browser = EXCLUDED.browser,
    //   os = EXCLUDED.os,
    //   device = EXCLUDED.device,
    //   country = EXCLUDED.country,
    //   region = EXCLUDED.region

    await queryRunner.manager.query(upsertQuery, parameters);
  }

  aggregateRedisData(statistics: RedisStatistics, isTestAb = false): AggregatedData {
    const aggregatedData: AggregatedData = {
      processed: parseInt(statistics.processed || '0'),
      delivered: parseInt(statistics.delivered || '0'),
      open: parseInt(statistics.open || '0'),
      unique_open: parseInt(statistics.unique_open || '0'),
      click: parseInt(statistics.click || '0'),
      unique_click: parseInt(statistics.unique_click || '0'),
      bounce: parseInt(statistics.bounce || '0'),
      blocked: parseInt(statistics.blocked || '0'),
      bot_click: parseInt(statistics.bot_click || '0'),
      datacenter_click: parseInt(statistics.datacenter_click || '0'),
      spam_report: parseInt(statistics.spam_report || '0'),
      unsubscribe: parseInt(statistics.unsubscribe || '0'),
      deferred: parseInt(statistics.deferred || '0'),
      sent: parseInt(statistics.sent || '0'),
      close: parseInt(statistics.close || '0'),

      pool: statistics.pool,
      is_test_ab: isTestAb,
      click_position_data: {},
      email_provider_data: {},
      browser_data: {},
      os_data: {},
      device_data: {
        mobile_open: 0,
        desktop_open: 0,
        mobile_click: 0,
        desktop_click: 0,
      },
      country_data: {},
      region_data: {},
    };

    Object.keys(statistics).forEach((key) => {
      // Aggregate click position data
      if (key.startsWith('click_position_')) {
        const position = key.split('_')[2];
        aggregatedData.click_position_data[position] = parseInt(statistics[key]);
      }

      // Aggregate email provider data
      if (key.startsWith('email_provider_')) {
        const [, , event, provider] = key.split('_');
        if (!aggregatedData.email_provider_data[event]) {
          aggregatedData.email_provider_data[event] = {};
        }
        aggregatedData.email_provider_data[event][provider] = parseInt(statistics[key]);
      }

      // Aggregate browser data
      if (key.startsWith('browser_')) {
        const [, event, browser] = key.split('_');
        if (!aggregatedData.browser_data[event]) {
          aggregatedData.browser_data[event] = {};
        }
        aggregatedData.browser_data[event][browser] = parseInt(statistics[key]);
      }

      // Aggregate OS data
      if (key.startsWith('os_')) {
        const [, event, os] = key.split('_');
        if (!aggregatedData.os_data[event]) {
          aggregatedData.os_data[event] = {};
        }
        aggregatedData.os_data[event][os] = parseInt(statistics[key]);
      }

      // Aggregate country data
      if (key.startsWith('country_')) {
        const [, event, country] = key.split('_');
        if (!aggregatedData.country_data[event]) {
          aggregatedData.country_data[event] = {};
        }
        aggregatedData.country_data[event][country] = parseInt(statistics[key]);
      }

      // Aggregate region data
      if (key.startsWith('region_')) {
        const [, event, region] = key.split('_');
        if (!aggregatedData.region_data[event]) {
          aggregatedData.region_data[event] = {};
        }
        aggregatedData.region_data[event][region] = parseInt(statistics[key]);
      }
    });

    // Aggregate device data
    ['mobile_open', 'desktop_open', 'mobile_click', 'desktop_click'].forEach((key) => {
      aggregatedData.device_data[key] = parseInt(statistics[key] || '0');
    });

    return aggregatedData;
  }

  /**
   * Removes statistics data from Redis that is older than 7 days.
   * @description
   * - Uses SCAN for efficient memory usage
   * - Processes keys in batches of 500
   * - Uses UNLINK for non-blocking deletion
   * - Prevents memory spikes during cleanup
   * @returns {Promise<void>}
   */
  async removeOldDataFromRedis(): Promise<void> {
    let cursor = '0';
    const sevenDaysAgo = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    const prefix = `statistics*${sevenDaysAgo}*`;
    const batchSize = 500;

    do {
      const [newCursor, keys] = await this.redisClient.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', batchSize);
      cursor = newCursor;

      if (keys.length > 0) {
        await this.redisClient.unlink(...keys); // Non-blocking deletion
        console.log(`Deleted ${keys.length} keys`);
      }
    } while (cursor !== '0');

    const twoDaysAgo = dayjs().subtract(2, 'day').format('YYYY-MM-DD');

    cursor = '0';
    do {
      const [newCursor, keys] = await this.redisClient.scan(cursor, 'MATCH', `account_events_unique:*${twoDaysAgo}*`, 'COUNT', batchSize);
      cursor = newCursor;

      if (keys.length > 0) {
        await this.redisClient.unlink(...keys); // Non-blocking deletion
        console.log(`Deleted ${keys.length} account_events_unique keys`);
      }
    } while (cursor !== '0');
  }
}
