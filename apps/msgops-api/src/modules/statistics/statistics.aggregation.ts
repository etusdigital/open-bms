import { Injectable } from '@nestjs/common';
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
import { VerifyStatisticType } from '../verify/verify-statistics.service';
import { VerifyMethod } from '../verify/verify.interface';
import { VerifyStatisticsEntity } from 'src/entities/verify-statistics.entity';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class StatisticsAggregationService {
  private readonly redisClient: Redis;

  constructor(
    private readonly accountService: AccountsService,
    private readonly redisService: RedisService,

    @InjectRepository(EventStatisticsEntity)
    private readonly eventStatisticsRepository: Repository<EventStatisticsEntity>,
    @InjectRepository(VerifyStatisticsEntity)
    private readonly verifyStatisticsRepository: Repository<VerifyStatisticsEntity>,
  ) {
    this.redisClient = this.redisService.getClient();
  }

  /**
   * Transfers statistics data from Redis to PostgreSQL for all active accounts
   * - Processes data for multiple platforms (email, web-push, mobile-push, etc.)
   * - Uses transactions to ensure data consistency
   * - Batches inserts for better performance
   * - Handles unique opens/clicks aggregation
   * - Manages test A/B campaign data
   * @scheduled Runs every 15 minutes via Cloud Scheduler
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

        // custom events
        const customEvents = await this.redisClient.smembers(`statistics_processed_custom_events:${account.id}:${currentDate}`);
        const pipeline = this.redisClient.pipeline();

        // TODO: process pageview events
        for (const eventId of customEvents) {
          if (eventId === 'null') {
            continue;
          }

          const statisticsKey = `statistics:${account.id}:${currentDate}:custom_events:${eventId}`;
          const uniqueKey = `statistics_unique:${account.id}:${currentDate}:custom_events:${eventId}`;

          pipeline.hgetall(statisticsKey);
          pipeline.scard(uniqueKey);
        }
        const results = await pipeline.exec();

        const batchSize = 100;
        const batches = [];
        for (let i = 0; i < customEvents.length; i++) {
          const eventId = customEvents[i];
          if (eventId === 'null') {
            continue;
          }

          const startIdx = i * 2;
          const statistics = results[startIdx][1] as any;
          statistics.events_count = statistics.count;
          statistics.events_unique = results[startIdx + 1][1] || 0;

          const aggregatedData = this.aggregateRedisData(statistics);

          batches.push({
            date: currentDate,
            accountId: account.id,
            eventType: 'custom_events',
            type: 'custom_event',
            eventId: parseInt(eventId),
            data: aggregatedData,
          });

          if (batches.length === batchSize || i === customEvents.length - 1) {
            await this.batchUpsertEventStatistics(batches, queryRunner, date);
            batches.length = 0;
          }
        }

        // TODO: add global custom events statistics and unique counts
        // // Process unique custom events counts for account-level statistics
        // const globalCustomEventsStatisticsKey = `account_events_statistics:${account.id}:custom_events:${currentDate}`;
        // const customEventUniquesPipeline = this.redisClient.pipeline();

        // // Get list of all custom event IDs that have unique tracking
        // const customEventUniqueKeys = await this.redisClient.keys(`account_events_unique:${account.id}:custom_events:${currentDate}:*`);

        // // Filter out hourly keys and extract event IDs
        // const customEventIds = customEventUniqueKeys.filter((key) => !key.includes(':hourly:')).map((key) => key.split(':').pop());

        // // Get unique counts for each custom event
        // for (const eventId of customEventIds) {
        //   const globalUniqueKey = `account_events_unique:${account.id}:custom_events:${currentDate}:${eventId}`;
        //   customEventUniquesPipeline.scard(globalUniqueKey);
        // }

        // const customEventUniquesResults = await customEventUniquesPipeline.exec();

        // // Update account-level statistics for custom events
        // const updateCustomEventsPipeline = this.redisClient.pipeline();
        // for (let i = 0; i < customEventIds.length; i++) {
        //   const eventId = customEventIds[i];
        //   const uniqueCount = customEventUniquesResults[i][1] || 0;
        //   updateCustomEventsPipeline.hset(globalCustomEventsStatisticsKey, `unique_${eventId}`, uniqueCount);
        // }

        // await updateCustomEventsPipeline.exec();

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
      record.messageId,
      record.automationId,
      record.campaignId,
      record.isTestAb || false,
      record.eventId,
      record.pool,
      record.provider,
      record.providerAccount,
      record.utmCampaign,
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
      record.data.events_count,
      record.data.events_unique,
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
          events_count, events_unique,
          click_position, email_provider, browser, os, device, country, region
        ) VALUES ${valuesIndex}`;

    if (date) {
      console.log(parameters);
    }

    // TODO: Retornar com o unique constraint quando limpar a sujeira do bigquery
    // digo mais, acho isso uma gambiarra das mais toscas mas é o que temos por enquanto
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
      events_count: parseInt(statistics.events_count || '0'),
      events_unique: parseInt(statistics.events_unique || '0'),

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
   * @scheduled Runs daily at midnight via Cloud Scheduler
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

  /**
   * Transfers 2FA statistics data from Redis to PostgreSQL for all active accounts
   * - Uses transactions to ensure data consistency
   * - Batches upserts for better performance
   * - Processes data for multiple 2FA methods (SMS, EMAIL, WHATSAPP)
   * @returns {Promise<void>}
   */
  async transferVerifyRedisDataToPostgres(): Promise<void> {
    const accounts = await this.accountService.getActiveAccountIds();

    for (const account of accounts) {
      const accountConfigVerify = await this.accountService.findConfig('2fa_settings', account.id);
      if (!accountConfigVerify.length) {
        continue;
      }
      const settings = JSON.parse(accountConfigVerify[0].value);
      const methods = Object.values(VerifyMethod);
      const currentDate = dayjs().subtract(15, 'minute').tz(account.time_zone).format('YYYY-MM-DD');

      const queryRunner = this.verifyStatisticsRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const batchRecords = [];

        for (const method of methods) {
          if (!Object.prototype.hasOwnProperty.call(settings, method.toLowerCase())) {
            continue;
          }
          const groupNames = Object.keys(settings[method.toLowerCase()]);
          for (const groupName of groupNames) {
            // Get all keys matching the pattern for this method and account
            const redisKey = `2fa_${method.toUpperCase()}_${groupName}_${account.id}_${currentDate}`;
            const statistics = await this.redisClient.hgetall(redisKey);
            // Only process if there's data
            if (Object.keys(statistics).length > 0) {
              batchRecords.push({
                accountId: account.id,
                date: currentDate,
                type: method.toUpperCase(),
                group: groupName,
                countTotal: parseInt(statistics[VerifyStatisticType.TOTAL] || '0'),
                countSuccess: parseInt(statistics[VerifyStatisticType.SUCCESS] || '0'),
                countError: parseInt(statistics[VerifyStatisticType.ERROR] || '0'),
                countVerifyValidated: parseInt(statistics[VerifyStatisticType.VALIDATED] || '0'),
                countVerifyRejected: parseInt(statistics[VerifyStatisticType.REJECTED] || '0'),
              });
            }
          }
        }

        if (batchRecords.length > 0) {
          await this.batchUpsert2faStatistics(batchRecords, queryRunner);
        }

        await queryRunner.commitTransaction();
      } catch (e) {
        await queryRunner.rollbackTransaction();
        console.error(`Error transferring verify statistics for account ${account.id}:`, e);
        throw e;
      } finally {
        await queryRunner.release();
      }
    }
  }

  private async batchUpsert2faStatistics(
    records: Array<{
      accountId: number;
      date: string;
      type: string;
      group: string;
      countTotal: number;
      countSuccess: number;
      countError: number;
      countVerifyValidated: number;
      countVerifyRejected: number;
    }>,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const valuesIndex = records
      .map((_, index) => {
        const offset = index * 9; // 9 columns (including group)
        return `($${1 + offset}, $${2 + offset}, $${3 + offset}, $${4 + offset}, $${5 + offset}, $${6 + offset}, $${7 + offset}, $${8 + offset}, $${9 + offset})`;
      })
      .join(',');

    const parameters = records.flatMap((record) => [
      record.accountId,
      record.date,
      record.type,
      record.group,
      record.countTotal,
      record.countSuccess,
      record.countError,
      record.countVerifyValidated,
      record.countVerifyRejected,
    ]);

    const upsertQuery = `
        INSERT INTO "verify_statistics" (
          account_id, date, type, "group", count_total, count_success, 
          count_error, count_verify_validated, count_verify_rejected
        ) VALUES ${valuesIndex}
        ON CONFLICT (account_id, type, date, "group")
        DO UPDATE SET
          count_total = EXCLUDED.count_total,
          count_success = EXCLUDED.count_success,
          count_error = EXCLUDED.count_error,
          count_verify_validated = EXCLUDED.count_verify_validated,
          count_verify_rejected = EXCLUDED.count_verify_rejected
      `;

    await queryRunner.manager.query(upsertQuery, parameters);
  }
}
