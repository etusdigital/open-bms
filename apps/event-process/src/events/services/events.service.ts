import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { RedisService } from '../../providers/redis/redis.service';
import { Redis, ChainableCommander } from 'ioredis';
import { UAParser } from 'ua-parser-js';
import { FormatterUtils } from '../../utils/formatter.utils';
import { PlatformType } from '../interfaces/push.interfaces';
import { MsgopsService } from '../../msgops/msgops.service';
import { EXCHANGES } from '@bms/messaging';
import { EventPublisherService } from '../../event-publisher.service';
import { EventLog, InternalEvent, InternalRequest, SendgridPayload } from '../interfaces/events.interfaces';
import { CacheService } from '../../msgops/cache.service';
import { GeoProvider, GEO_PROVIDER_TOKEN, Traits } from '@bms/geo';
import { AnalyticsPublisherProvider } from '../../providers/analytics-publisher.provider';
import { BotDetector } from '../../utils/bot-detector';
import crypto from 'crypto';

function toClickhouseDateTime(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

@Injectable()
export class EventsService {
  protected redisClient: Redis;
  private static userAgentParser: UAParser | null = null;

  constructor(
    protected readonly redisService: RedisService,
    protected readonly formatterUtils: FormatterUtils,
    protected readonly msgOpsService: MsgopsService,
    protected readonly eventPublisher: EventPublisherService,
    private readonly cacheService: CacheService,
    @Inject(GEO_PROVIDER_TOKEN) private readonly geoProvider: GeoProvider,
    protected readonly analyticsPublisher: AnalyticsPublisherProvider,
  ) {
    this.redisClient = this.redisService.getOrThrow();
    if (!EventsService.userAgentParser) {
      EventsService.userAgentParser = new UAParser();
    }
  }

  protected async getGeoIpInfo(
    ip: string,
  ): Promise<{ country?: string; region?: string; city?: string; traits?: Traits }> {
    if (!ip || process.env.GEO_ENRICHMENT_ENABLED !== 'true') return {};
    try {
      const geoData = await this.geoProvider.lookup(ip);
      if (!geoData) return {};
      return {
        country: geoData.country,
        region: geoData.region,
        city: geoData.city,
        traits: geoData.traits,
      };
    } catch (error) {
      this.formatterUtils.logInfo(`Error getting GeoIP info for ${ip}: ${error}`);
      return {};
    }
  }

  protected handleRedisResults(results: [Error | null, any][]): void {
    results.forEach((result, index) => {
      if (result[0]) {
        console.error(`Error in Redis operation ${index}:`, result[0]);
      }
    });
  }

  protected userAgentFormatter(userAgent: string): {
    is_mobile: boolean;
    user_agent: string;
    os: string | null;
    os_version: string | null;
    browser: string | null;
  } {
    // Check cache first
    const cachedResult = this.cacheService.get<{
      is_mobile: boolean;
      user_agent: string;
      os: string | null;
      os_version: string | null;
      browser: string | null;
    }>('userAgent', userAgent);

    if (cachedResult) {
      return cachedResult;
    }

    // Parse user agent if not in cache
    EventsService.userAgentParser.setUA(userAgent);
    const result = EventsService.userAgentParser.getResult();
    const formattedResult = {
      is_mobile: result?.device?.type === 'mobile',
      user_agent: userAgent,
      os: result?.os?.name || null,
      os_version: result?.os?.version || null,
      browser: result?.browser?.name || null,
    };

    // Cache the result
    this.cacheService.set('userAgent', userAgent, formattedResult);

    return formattedResult;
  }

  // Idempotency window must outlast the AMQP retry budget so retried deliveries
  // (initial + 3 retries with backoff) hit the processed-marker instead of
  // re-processing. 1h covers worst-case DLQ replay tempos.
  private static readonly PROCESSED_TTL_SECONDS = 60 * 60;

  protected async acquireLock(messageId: string): Promise<string | null> {
    const token = crypto.randomUUID();
    const result = await this.redisClient.set(`event-process:processing_lock:${messageId}`, token, 'EX', 60, 'NX');
    return result === 'OK' ? token : null;
  }

  // Compare-and-delete via Lua so we never release a lock owned by someone else
  // (e.g. when our processor took longer than the TTL and a sibling consumer
  // already acquired a fresh lock with a new token).
  protected async releaseLock(messageId: string, token: string): Promise<void> {
    const script = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
    await this.redisClient.eval(script, 1, `event-process:processing_lock:${messageId}`, token);
  }

  protected async isMessageProcessed(messageId: string): Promise<boolean> {
    const exists = await this.redisClient.exists(`event-process:processed_message:${messageId}`);
    return exists === 1;
  }

  protected async markMessageAsProcessed(messageId: string): Promise<void> {
    await this.redisClient.set(
      `event-process:processed_message:${messageId}`,
      '1',
      'EX',
      EventsService.PROCESSED_TTL_SECONDS,
    );
  }

  async processWithIdempotency<T>(
    messageId: string,
    processor: () => Promise<T>,
  ): Promise<T | { status: string; message: string }> {
    if (!messageId) {
      throw new BadRequestException('Message ID is required');
    }

    const isProcessed = await this.isMessageProcessed(messageId);
    if (isProcessed) {
      console.log(`[Event-Process] - Message already processed: ${messageId}`);
      return { status: 'skipped', message: 'Message already processed' };
    }

    const lockToken = await this.acquireLock(messageId);
    if (!lockToken) {
      console.log(`[Event-Process] - Message is currently being processed: ${messageId}`);
      return { status: 'skipped', message: 'Message is currently being processed' };
    }

    try {
      const isProcessedAfterLock = await this.isMessageProcessed(messageId);
      if (isProcessedAfterLock) {
        console.log(`[Event-Process] - Message already processed after lock: ${messageId}`);
        return { status: 'skipped', message: 'Message already processed' };
      }

      const result = await processor();

      await this.markMessageAsProcessed(messageId);

      return result;
    } finally {
      await this.releaseLock(messageId, lockToken);
    }
  }

  protected updateEventStatistics(
    pipeline: ChainableCommander,
    options: {
      accountId: number;
      messageId?: number;
      eventId: number;
      event: string;
      contactId: number;
      platform: PlatformType;
      type?: 'automation' | 'campaign' | 'transactional';
      timeZone: string;
      timestamp: number;
      pool?: string;
      utmCampaign?: string;
      providerAccount?: string;
      linkPosition?: number;
      userAgent?: string;
      ip?: string;
      emailProvider?: string;
      isTestAb?: boolean;
      sent_at?: string;
      batch_page?: string;
      batch_schedule_to?: string;
      batch_spread?: string;
      email?: string;
      uuid?: string;
      geoData?: { country?: string; region?: string; city?: string; traits?: Traits };
    },
  ): void {
    const currentDate = this.formatterUtils.convertTimestampToTimezone(options.timestamp, options.timeZone);
    const currentHour = this.formatterUtils.convertTimestampToTimezone(options.timestamp, options.timeZone, true);
    let statisticsKey = `statistics:${options.accountId}:${currentDate}:${options.platform}:${options.type}:${options.eventId}:${options.messageId}${options.providerAccount ? `:${options.providerAccount}` : ''}${options.isTestAb ? ':testab' : ''}`;
    if (options.platform === PlatformType.CUSTOMEVENTS) {
      options.event = 'count';
      statisticsKey = `statistics:${options.accountId}:${currentDate}:${options.platform}:${options.eventId}`;
    }
    // Increment the event count
    pipeline.hincrby(statisticsKey, options.event, 1);
    // Increment the event count by hour
    pipeline.hincrby(statisticsKey, `hourly_${options.event}:${currentHour}`, 1);

    if (options.utmCampaign) {
      pipeline.hset(statisticsKey, 'utm_campaign', options.utmCampaign);
    }

    if (options.providerAccount) {
      pipeline.hset(statisticsKey, 'provider_account', options.providerAccount);
    }

    if (options.platform === PlatformType.EMAIL) {
      pipeline.hset(statisticsKey, 'pool', options.pool);

      if (options.event === 'click' && options.linkPosition !== undefined) {
        pipeline.hincrby(statisticsKey, `click_position_${options.linkPosition}`, 1);
      }

      if (options.emailProvider) {
        pipeline.hincrby(statisticsKey, `email_provider_${options.event}_${options.emailProvider}`, 1);
      }

      if (options.event === 'open' && options.sent_at && options.timestamp) {
        const secondsSinceSent = Math.floor(options.timestamp - Number(options.sent_at) / 1000);
        if (secondsSinceSent < 5) {
          pipeline.hincrby(statisticsKey, `open_under_5_seconds`, 1);
        }
        if (secondsSinceSent >= 5 && secondsSinceSent < 10) {
          pipeline.hincrby(statisticsKey, `open_under_10_seconds`, 1);
        }
        if (secondsSinceSent >= 10 && secondsSinceSent < 30) {
          pipeline.hincrby(statisticsKey, `open_under_30_seconds`, 1);
        }
        if (secondsSinceSent >= 30 && secondsSinceSent < 60) {
          pipeline.hincrby(statisticsKey, `open_under_60_seconds`, 1);
        }
        if (secondsSinceSent >= 60 && secondsSinceSent < 300) {
          pipeline.hincrby(statisticsKey, `open_under_5_minutes`, 1);
        }
        if (secondsSinceSent >= 300) {
          pipeline.hincrby(statisticsKey, `open_over_5_minutes`, 1);
        }
      }
    }

    // Add message/event ID to the list of processed messages/events
    if (options.platform !== PlatformType.CUSTOMEVENTS) {
      const dailyListKey = `statistics_processed_messages:${options.accountId}:${currentDate}:${options.platform}`;
      pipeline.sadd(
        dailyListKey,
        `${options.type}:${options.eventId}:${options.messageId}${options.providerAccount ? `:${options.providerAccount}` : ''}${options.isTestAb ? ':testab' : ''}`,
      );
    }

    if (options.platform === PlatformType.CUSTOMEVENTS) {
      const dailyListKey = `statistics_processed_custom_events:${options.accountId}:${currentDate}`;
      pipeline.sadd(dailyListKey, `${options.eventId}`);

      const lastEventKey = `statistics:${options.accountId}:${options.platform}:${options.eventId}:last_occurrence`;
      pipeline.set(lastEventKey, options.timestamp.toString());
    }

    const globalAccountStatisticsKey = `account_events_statistics:${options.accountId}:${options.platform}:${currentDate}`;
    pipeline.hincrby(globalAccountStatisticsKey, options.event, 1);
    pipeline.hincrby(globalAccountStatisticsKey, `hourly_${options.event}:${currentHour}`, 1);

    // Track unique contacts for account-level statistics for all event types
    const eventsToTrackUnique = ['delivered', 'open', 'click', 'unsubscribe', 'bounce', 'blocked'];
    if (
      options.contactId &&
      (eventsToTrackUnique.includes(options.event) || options.platform === PlatformType.CUSTOMEVENTS)
    ) {
      const globalUniqueKey = `account_events_unique:${options.accountId}:${options.platform}:${currentDate}:${options.platform === PlatformType.CUSTOMEVENTS ? options.eventId : options.event}`;
      pipeline.sadd(globalUniqueKey, options.contactId);

      // Also track hourly unique counts
      const hourlyUniqueKey = `account_events_unique:${options.accountId}:${options.platform}:${currentDate}:hourly:${currentHour}:${options.platform === PlatformType.CUSTOMEVENTS ? options.eventId : options.event}`;
      pipeline.sadd(hourlyUniqueKey, options.contactId);
    }

    if (options.event === 'click' || options.event === 'open' || options.platform === PlatformType.CUSTOMEVENTS) {
      const uniqueEventsKey = `statistics_unique:${options.accountId}:${currentDate}:${options.platform}:${options.type ? `${options.type}:` : ''}${options.eventId}${options.messageId ? `:${options.messageId}` : ''}${options.providerAccount ? `:${options.providerAccount}` : ''}${options.isTestAb ? ':testab' : ''}${options.platform !== PlatformType.CUSTOMEVENTS ? `:${options.event}` : ''}`;
      pipeline.sadd(uniqueEventsKey, options.contactId || options.email || options.uuid);

      if (options.userAgent) {
        const { browser, os, is_mobile } = this.userAgentFormatter(options.userAgent);
        if (browser) pipeline.hincrby(statisticsKey, `browser_${options.event}_${browser}`, 1);
        if (os) pipeline.hincrby(statisticsKey, `os_${options.event}_${os}`, 1);
        if (is_mobile)
          pipeline.hincrby(statisticsKey, `${is_mobile ? `mobile_${options.event}` : `desktop_${options.event}`}`, 1);
      }

      if (options.geoData) {
        if (options.geoData.country)
          pipeline.hincrby(statisticsKey, `country_${options.event}_${options.geoData.country}`, 1);
        if (options.geoData.region)
          pipeline.hincrby(statisticsKey, `region_${options.event}_${options.geoData.region}`, 1);
        if (options.geoData.city) pipeline.hincrby(statisticsKey, `city_${options.event}_${options.geoData.city}`, 1);
      }

      // Click-only aggregate counters. Opens are NOT aggregated into bot_/
      // datacenter_ columns: Gmail/Apple-MPP/Outlook image proxies make
      // prefetch-vs-real-read indistinguishable at the IP layer, so a
      // bot_open count would imply a misleading "human_open" complement.
      // See docs/plans/2026-04-20-bot-detection-mmdb-refactor.md decision 6.
      if (options.event === 'click') {
        const signals = BotDetector.classify(options.geoData?.traits, options.userAgent);
        if (signals.isBot) {
          pipeline.hincrby(statisticsKey, 'bot_click', 1);
          pipeline.hincrby(globalAccountStatisticsKey, 'bot_click', 1);
        }
        if (signals.isDatacenter) {
          pipeline.hincrby(statisticsKey, 'datacenter_click', 1);
          pipeline.hincrby(globalAccountStatisticsKey, 'datacenter_click', 1);
        }
      }
    }
  }

  protected async createRedisKey(keyName: string, emails: string[], expireInHours: number): Promise<void> {
    const pipeline = this.redisClient.pipeline();

    emails.forEach((email) => {
      pipeline.set(`${keyName}:${email}`, 'true', 'EX', 60 * 60 * expireInHours);
    });

    const results = await pipeline.exec();
    this.handleRedisResults(results);
  }

  protected async deleteRedisKey(keyName: string, emails: string[]): Promise<void> {
    const pipeline = this.redisClient.pipeline();

    emails.forEach((email) => {
      pipeline.del(`${keyName}:${email}`);
    });

    const results = await pipeline.exec();
    this.handleRedisResults(results);
  }

  protected async publishAutomationTarget(payload) {
    await this.eventPublisher.publish(EXCHANGES.tags, 'tag.process', payload, { type: 'automation-target' });
  }

  /**
   * Triggers events based on the event type and publishes async messages to the AMQP exchange.
   * @param key The event type (open, click, custom_events)
   * @param events The events to process
   * @param accountId The account ID (optional for custom_events)
   */
  protected async eventsTrigger(
    key: 'open' | 'click' | 'custom_events',
    events: SendgridPayload[] | EventLog[],
    accountId?: number,
  ): Promise<void> {
    if (!this.eventPublisher) {
      this.formatterUtils.logInfo(`[events-trigger] EventPublisher not available for ${key} events`);
      return;
    }

    for (const event of events) {
      if (key === 'custom_events') {
        accountId = (event as EventLog).accountId;
      }

      if (key === 'open' && 'contactId' in event && event.contactId) {
        const contactId = Number(event.contactId);
        if (isNaN(contactId)) {
          this.formatterUtils.logInfo(`[events-trigger] Invalid contactId: ${JSON.stringify(event)}`);
          continue;
        }

        const eventKey = `events_trigger:${accountId}:first_open_30_days:0`;
        const hasTrigger = await this.redisClient.exists(eventKey);
        if (hasTrigger) {
          const contact = await this.msgOpsService.findContactById(accountId, contactId);
          if (
            contact &&
            (contact.last_open === null || contact.last_open < new Date(Date.now() - 1000 * 60 * 60 * 24 * 30))
          ) {
            await this.eventPublisher.publish(
              EXCHANGES.tags,
              'tag.process',
              { accountId, event: 'first_open_30_days', contactId: event.contactId, messageId: 0 },
              { type: 'events-trigger' },
            );
          }
        }
      }

      const messageId = 'category' in event ? this.formatterUtils.parseEventType(event.category, 'message') : null;
      let eventKey;
      let eventKeyCampaign;
      if (key === 'custom_events' && 'uuid' in event) {
        eventKey = `events_trigger:${accountId}:${key}:${event.eventId}`;
        eventKeyCampaign = `events_trigger:campaign:${accountId}:${key}:${event.eventId}`;
      }

      if (['open', 'click'].includes(key) && event.contactId && messageId) {
        eventKey = `events_trigger:${accountId}:${key}:${messageId}`;
        eventKeyCampaign = `events_trigger:campaign:${accountId}:${key}:${messageId}`;
      }

      let hasTrigger = await this.redisClient.exists(eventKey);
      let hasTriggerCampaign = await this.redisClient.exists(eventKeyCampaign);
      let getAllEvents = false;
      let getAllEventsCampaign = false;
      if (!hasTrigger) {
        getAllEvents = true;
        const eventKeyAll = `events_trigger:${accountId}:${key}:0`;
        hasTrigger = await this.redisClient.exists(eventKeyAll);
      }

      if (!hasTriggerCampaign) {
        getAllEventsCampaign = true;
        const eventKeyAllCampaign = `events_trigger:campaign:${accountId}:${key}:0`;
        hasTriggerCampaign = await this.redisClient.exists(eventKeyAllCampaign);
      }

      if (hasTrigger || hasTriggerCampaign) {
        const payload: {
          accountId: number;
          event: 'click' | 'open' | 'custom_events';
          uuid?: string;
          eventId?: number;
          contactId?: number;
          messageId?: string | number;
          isTriggerCampaign?: boolean;
        } = {
          accountId,
          event: key,
        };

        if (key === 'custom_events' && 'uuid' in event && event.uuid && event.uuid != '') {
          payload['uuid'] = event.uuid;
          payload['eventId'] = event.eventId;
          if (hasTrigger) {
            await this.eventPublisher.publish(EXCHANGES.tags, 'tag.process', payload, {
              type: 'events-trigger',
            });
          }
          if (hasTriggerCampaign) {
            payload['isTriggerCampaign'] = true;
            await this.eventPublisher.publish(EXCHANGES.tags, 'tag.process', payload, {
              type: 'events-trigger',
            });
          }
        }

        if (
          ['open', 'click'].includes(key) &&
          event.contactId &&
          (!getAllEvents || !getAllEventsCampaign) &&
          messageId
        ) {
          payload['contactId'] = Number(event.contactId);
          payload['messageId'] = messageId;
          if (hasTrigger && !getAllEvents) {
            await this.eventPublisher.publish(EXCHANGES.tags, 'tag.process', payload, {
              type: 'events-trigger',
            });
          }
          if (hasTriggerCampaign && !getAllEventsCampaign) {
            payload['isTriggerCampaign'] = true;
            await this.eventPublisher.publish(EXCHANGES.tags, 'tag.process', payload, {
              type: 'events-trigger',
            });
          }
        }

        if (['open', 'click'].includes(key) && (getAllEvents || getAllEventsCampaign) && 'contactId' in event) {
          payload['contactId'] = Number(event.contactId);
          payload['messageId'] = 0;
          if (hasTrigger && getAllEvents) {
            await this.eventPublisher.publish(EXCHANGES.tags, 'tag.process', payload, {
              type: 'events-trigger',
            });
          }
          if (hasTriggerCampaign && getAllEventsCampaign) {
            payload['isTriggerCampaign'] = true;
            await this.eventPublisher.publish(EXCHANGES.tags, 'tag.process', payload, {
              type: 'events-trigger',
            });
          }
        }
      }
    }
  }

  async processActivationEvents(events: InternalEvent[]) {
    await this.eventPublisher.publish(EXCHANGES.events, 'event.received.internal', {
      payload: events,
      platform: PlatformType.INTERNALEVENTS,
    } as InternalRequest);
  }

  protected async sendAnalyticsEvent(events) {
    await Promise.all(
      events.map(async (message) => {
        const analyticsMessage = this.processMessageToAnalytics(message);
        // processMessageToAnalytics returns null for messages we refuse to
        // publish (e.g. missing time). Skipping here keeps the batch alive
        // instead of feeding malformed rows into the CH RabbitMQ engine.
        if (!analyticsMessage) return;
        await this.analyticsPublisher.publish(analyticsMessage);
      }),
    );
  }

  private processMessageToAnalytics(message) {
    // Traits arrive on the message via the upstream getGeoIpInfo() spread
    // (see event service callers that attach geoData). When absent — e.g.
    // non-click/open events or lookup failures — BotDetector returns
    // all-false defaults. Per plan decision 6, stamping is symmetric for
    // clicks and opens; only Redis/Postgres aggregation is click-only.
    // userAgent lets BotDetector upgrade is_datacenter hits with
    // script/bot UAs (Shop Service, curl, Googlebot, etc.) to is_bot;
    // see docs/plans/2026-04-20-ua-denylist-for-bot-detection.md.
    const signals = BotDetector.classify(message.traits, message.userAgent ?? message.user_agent);

    // `traits` is an internal-only field carried on the EventLog to feed
    // BotDetector here; strip it from the outgoing payload because
    // downstream (ClickHouse events_logs_v2) has no `traits` column.
    // The six derived fields land in `properties` below instead.
    const { traits: _traits, ...rest } = message;

    // The CH RabbitMQ engine ignores DEFAULT/MATERIALIZED columns, so
    // `time_date Date DEFAULT toDate(time)` (and the bare `date Date` column,
    // which has no DEFAULT at all) would silently land as the 1970-01-01
    // epoch and then be dropped by the 180-day TTL. Derive both producer-side.
    // See Section 14.3 of the planning doc.
    //
    // CH parses DateTime64 from JSONEachRow as 'YYYY-MM-DD HH:MM:SS.sss',
    // not the ISO 'T...Z' form that JSON.stringify(new Date()) emits, so
    // normalize time and value_time before publish or the queue rows fail
    // to insert with "Cannot parse input: expected '\"' before: 'Z'".
    // Refuse to publish events without a usable `time`: the CH RabbitMQ engine
    // cannot parse JSONEachRow rows where DateTime64 fields are missing/empty
    // and once it sees one, it falls into a "consume + drop" state until the
    // server is restarted (see docs/deployment.md). Skipping here keeps the
    // pipeline healthy and surfaces the producer-side bug to logs.
    if (!message.time) {
      this.formatterUtils.logInfo(
        `[Event-Process] processMessageToAnalytics: dropping event without time (event=${message.event} account_id=${message.accountId ?? message.account_id ?? 'unknown'})`,
      );
      return null;
    }
    const time = toClickhouseDateTime(message.time);
    const timeDate = new Date(message.time).toISOString().slice(0, 10);
    const valueTime = message.valueTime ?? message.value_time;
    const valueTimeFormatted = valueTime ? toClickhouseDateTime(valueTime) : undefined;

    // Wrap JSON.stringify so a single malformed message (circular ref, BigInt,
    // non-serializable value) doesn't reject the whole batch via Promise.all.
    const propertiesPayload = {
      ...(message.properties ?? {}),
      is_bot: signals.isBot,
      is_datacenter: signals.isDatacenter,
      bot_classification: signals.classification,
      asn: signals.asn,
      asn_org: signals.asnOrg,
      user_type: signals.userType,
    };
    let propertiesString: string;
    try {
      propertiesString = JSON.stringify(propertiesPayload);
    } catch (err) {
      this.formatterUtils.logInfo(
        `[Event-Process] processMessageToAnalytics: properties not serializable (event=${message.event}); falling back to bot signals only. Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      propertiesString = JSON.stringify({
        is_bot: signals.isBot,
        is_datacenter: signals.isDatacenter,
        bot_classification: signals.classification,
        asn: signals.asn,
        asn_org: signals.asnOrg,
        user_type: signals.userType,
      });
    }

    return {
      ...rest,
      account_id: message.accountId ?? message.account_id,
      message_type: message.messageType ?? message.message_type,
      contact_id: message.contactId ?? message.contact_id,
      automation_id: message.automationId ?? message.automation_id,
      campaign_id: message.campaignId ?? message.campaign_id,
      message_id: message.messageId ?? message.message_id,
      utm_campaign: message.utmCampaign ?? message.utm_campaign,
      is_test_ab: message.isTestAb ?? message.is_test_ab,
      events_logs_id: message.eventsLogsId ?? message.events_logs_id,
      event_log_id: crypto.randomUUID(),
      event_id: message.eventId ?? message.event_id,
      user_agent: message.userAgent ?? message.user_agent,
      is_mobile: message.isMobile ?? message.is_mobile,
      os_version: message.osVersion ?? message.os_version,
      link_position: message.linkPosition ?? message.link_position,
      value_number: message.valueNumber ?? message.value_number,
      value_time: valueTimeFormatted,
      seconds_since_sent: message.secondsSinceSent ?? message.seconds_since_sent,
      provider_account: message.providerAccount ?? message.provider_account,
      time: time,
      time_date: timeDate,
      date: timeDate,
      // Serialized as a string so the CH RabbitMQ engine consumes it under
      // a String column; the materialized view casts to JSON when inserting
      // into events_logs_v2.properties.
      properties: propertiesString,
    };
  }
}
