import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { RedisService } from '../providers/redis/redis.service';
import { Contact, ContactDeviceEditableAttributes, ContactEditableAttributes } from '../app.interfaces';
import { PG_CONNECTION, PG_CONNECTION_LOGS } from '../providers/constants';
import format from 'pg-format';
import { QueryResult } from 'pg';
import { FormatterUtils } from '../utils/formatter.utils';
import { Redis } from 'ioredis';
import { CacheService } from './cache.service';
import { ContactValidateEditableAttributes } from '../events/interfaces/events.interfaces';

@Injectable()
export class MsgopsService {
  private readonly redisClient: Redis;
  constructor(
    @Inject(PG_CONNECTION) private pgPool: any,
    @Inject(PG_CONNECTION_LOGS) private pgPoolLogs: any,

    private readonly redisService: RedisService,
    private readonly formatterUtils: FormatterUtils,
    private readonly cacheService: CacheService,
  ) {
    this.redisClient = this.redisService.getOrThrow();
  }

  /**
   * Checks if the PostgreSQL connections are alive and available
   * @param retries Number of retry attempts (default: 3)
   * @param delay Delay between retries in milliseconds (default: 1000)
   * @throws {InternalServerErrorException} If any connection is not available after retries
   */
  async checkPostgresConnection(retries = 3, delay = 1000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await Promise.all([this.pgPool.query('SELECT 1'), this.pgPoolLogs.query('SELECT 1')]);
        return;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        const errorMessage = error.code ? `${error.code}: ${error.message}` : error.message;

        console.error(`PostgreSQL connection check failed (attempt ${attempt}/${retries}):`, {
          error: errorMessage,
          stack: error.stack,
        });

        if (isLastAttempt) {
          throw new InternalServerErrorException('Database connection is not available after multiple attempts', {
            cause: error,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async findAccountIdByApiKey(apiKey: string): Promise<number> {
    // Check memory cache first
    const cachedAccountId = this.cacheService.get<number>('apiKey', apiKey);
    if (cachedAccountId) {
      return cachedAccountId;
    }

    // Check Redis cache
    const redisKey = `account_id_by_api_key:${apiKey}`;
    const accountIdCached: number = await this.redisClient.get(redisKey).then((value) => Number(value));
    if (accountIdCached) {
      // Update memory cache
      this.cacheService.set('apiKey', apiKey, accountIdCached);
      return accountIdCached;
    }

    const accountConfig: QueryResult = await this.pgPool.query(
      `SELECT account_id FROM accounts_configs WHERE name IN ('api_key', 'api_key_tracker') AND value = $1::text`,
      [apiKey],
    );
    const accountId = accountConfig.rows[0]?.account_id || 0;

    // Update both Redis and memory cache
    const expireIn7Days = 60 * 60 * 24 * 7;
    await this.redisClient.set(redisKey, accountId, 'EX', expireIn7Days);
    this.cacheService.set('apiKey', apiKey, accountId);

    return accountId;
  }

  async findContactById(accountId: number, id: number): Promise<Contact> {
    if (isNaN(id)) {
      return null;
    }
    const contactQuery: QueryResult = await this.pgPool.query(
      'SELECT * FROM contacts WHERE account_id = $1 AND id = $2',
      [accountId, id],
    );
    const contact = contactQuery.rows.length ? contactQuery.rows[0] : null;

    return contact;
  }

  async findContactByEmail(accountId: number, email: string): Promise<Contact> {
    const contactQuery: QueryResult = await this.pgPool.query(
      'SELECT id FROM contacts WHERE account_id = $1 AND email = $2',
      [accountId, email],
    );
    const contact = contactQuery.rows.length ? contactQuery.rows[0] : null;

    return contact;
  }

  async findContactByUuid(accountId: number, uuid: string): Promise<Contact> {
    const contactQuery: QueryResult = await this.pgPool.query(
      'SELECT id FROM contacts WHERE account_id = $1 AND uuid = $2',
      [accountId, uuid],
    );
    const contact = contactQuery.rows.length ? contactQuery.rows[0] : null;

    return contact;
  }

  async getAccountTimeZone(id: number): Promise<string> {
    // Check memory cache first
    const cachedTimezone = this.cacheService.get<string>('timezone', id);
    if (cachedTimezone) {
      return cachedTimezone;
    }

    // Check Redis cache
    const redisKey = `account_time_zone:${id}`;
    const accountRedis = await this.redisClient.get(redisKey);
    if (accountRedis) {
      // Update memory cache
      this.cacheService.set('timezone', id, accountRedis);
      return accountRedis;
    }

    try {
      const result: QueryResult = await this.pgPool.query(
        "SELECT * FROM accounts_configs WHERE account_id = $1::int AND name = 'time_zone'",
        [id],
      );

      if (result.rowCount === 0) {
        const defaultTimezone = 'UTC';
        this.cacheService.set('timezone', id, defaultTimezone);
        return defaultTimezone;
      }

      const timeZone = result.rows[0].value;

      // Update both Redis and memory cache
      const expireIn7Days = 60 * 60 * 24 * 7;
      await this.redisClient.set(redisKey, timeZone, 'EX', expireIn7Days);
      this.cacheService.set('timezone', id, timeZone);

      return timeZone;
    } catch (error) {
      console.error(`Log - error getAccountTimeZone id: ${id}`);
      console.error(`Log - error: ${JSON.stringify(error)}`);
      const defaultTimezone = 'UTC';
      this.cacheService.set('timezone', id, defaultTimezone);
      return defaultTimezone;
    }
  }

  async updateContactsById(ids: number[], accountId: number, changes: ContactEditableAttributes): Promise<QueryResult> {
    const query = format(
      'UPDATE contacts SET %s WHERE account_id = %s AND id IN (%L)',
      this.prepareUpdate(changes),
      accountId,
      ids,
    );
    try {
      return this.pgPool.query(query);
    } catch (error) {
      console.error(`Log - query: ${JSON.stringify(query)}`);
      console.error(`Log - error: ${JSON.stringify(error)}`);
      throw new Error('Error to update contact by id', { cause: error });
    }
  }

  async batchUpdateContactsBounce(
    entries: { id: number; bounceType: 'HARD' | 'SOFT'; bouncedAt: Date }[],
    accountId: number,
  ): Promise<QueryResult> {
    if (!entries.length) return;
    const rows = entries.map((e) => [e.id, e.bounceType, e.bouncedAt.toISOString()]);
    const query = format(
      `UPDATE contacts AS c
       SET has_bounced = true,
           bounce_type = v.bounce_type,
           bounced_at  = v.bounced_at::timestamptz,
           updated_at  = NOW()
       FROM (VALUES %L) AS v(id, bounce_type, bounced_at)
       WHERE c.account_id = %s
         AND c.id = v.id::integer
         AND (v.bounce_type = 'HARD' OR c.bounce_type IS DISTINCT FROM 'HARD')`,
      rows,
      accountId,
    );
    try {
      return this.pgPool.query(query);
    } catch (error) {
      console.error(`Log - query: ${JSON.stringify(query)}`);
      console.error(`Log - error: ${JSON.stringify(error)}`);
      throw new Error('Error batch-updating contacts bounce', { cause: error });
    }
  }

  async batchUpsertValidationBounce(entries: { email: string; bouncedAt: Date }[]): Promise<QueryResult> {
    if (!entries.length) return;
    const rows = entries.map((e) => [e.email, e.bouncedAt.toISOString()]);
    const query = format(
      `INSERT INTO email_validations (email, bounced_at)
       SELECT v.email, v.bounced_at::timestamptz
       FROM (VALUES %L) AS v(email, bounced_at)
       ON CONFLICT (email) DO UPDATE SET
         bounced_at = EXCLUDED.bounced_at,
         updated_at = NOW()`,
      rows,
    );
    try {
      return this.pgPool.query(query);
    } catch (error) {
      console.error(`Log - query: ${JSON.stringify(query)}`);
      console.error(`Log - error: ${JSON.stringify(error)}`);
      throw new Error('Error batch-upserting validation bounce', { cause: error });
    }
  }

  async clearValidationUnsubscribed(emails: string[]): Promise<QueryResult> {
    const uniqueEmails = [...new Set(emails)];
    const query = format(
      `UPDATE email_validations SET unsubscribed_at = NULL, updated_at = NOW() WHERE email IN (%L)`,
      uniqueEmails,
    );
    try {
      return this.pgPool.query(query);
    } catch (error) {
      console.error(`Log - query: ${JSON.stringify(query)}`);
      console.error(`Log - error: ${JSON.stringify(error)}`);
      throw new Error('Error clearing validation unsubscribed_at', { cause: error });
    }
  }

  async updateContactsValidateByEmail(
    emails: string[],
    changes: ContactValidateEditableAttributes,
  ): Promise<QueryResult> {
    const uniqueEmails = [...new Set(emails)];

    const query = format(
      `
      INSERT INTO email_validations (email, last_open, last_click, unsubscribed_at, bounced_at)
        VALUES %L
        ON CONFLICT (email)
        DO UPDATE SET
          last_open = COALESCE(EXCLUDED.last_open, email_validations.last_open),
          last_click = COALESCE(EXCLUDED.last_click, email_validations.last_click),
          unsubscribed_at = COALESCE(EXCLUDED.unsubscribed_at, email_validations.unsubscribed_at),
          bounced_at = COALESCE(EXCLUDED.bounced_at, email_validations.bounced_at),
          updated_at = NOW();
      `,
      uniqueEmails.map((email) => [
        email,
        changes.lastOpen,
        changes.lastClick,
        changes.unsubscribedAt,
        changes.bouncedAt,
      ]),
    );
    try {
      return this.pgPool.query(query);
    } catch (error) {
      console.error(`Log - query: ${JSON.stringify(query)}`);
      console.error(`Log - error: ${JSON.stringify(error)}`);
      throw new Error('Error to update email validate', { cause: error });
    }
  }

  async updateContactDevices(
    ids: string[],
    accountId: number,
    changes: ContactDeviceEditableAttributes,
  ): Promise<QueryResult> {
    if (!accountId || !ids || ids.length === 0) {
      return;
    }
    const query = format(
      'UPDATE contacts_devices SET %s WHERE account_id = %s AND id IN (%L)',
      this.prepareUpdate(changes),
      accountId,
      ids,
    );
    try {
      return this.pgPool.query(query);
    } catch (error) {
      console.error(`Log - query: ${JSON.stringify(query)}`);
      console.error(`Log - error: ${JSON.stringify(error)}`);
      throw new Error('Error to update contact devices', { cause: error });
    }
  }

  async saveEventsLogs(dataToInsert: any): Promise<QueryResult> {
    if (!dataToInsert || dataToInsert.length === 0) {
      this.formatterUtils.logInfo(`Array is empty or not provided: ${JSON.stringify(dataToInsert)}`);
      return { rows: [] } as QueryResult;
    }

    const statement = this.prepareQuery(dataToInsert);
    const query = format('INSERT INTO events_logs (%s) VALUES %L', statement.keys, statement.values);
    try {
      const result = await this.pgPoolLogs.query(query);
      return result;
    } catch (error) {
      console.error(`Log - query: ${query}`);
      console.error(`Log - error: ${JSON.stringify(error)}`);
      throw new Error('Error to save logs', { cause: error });
    }
  }

  async findMessageAssociation(
    accountId: number,
    messageId: number,
    name: string,
  ): Promise<{ campaignId?: number; automationId?: number }> {
    const cacheKey = `${accountId}:${messageId}:${name}`;

    const cached = this.cacheService.get<{ campaignId?: number; automationId?: number }>(
      'message_association',
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const redisKey = `message_association:${cacheKey}`;
    const redisCached = await this.redisClient.get(redisKey);
    if (redisCached !== null) {
      const parsed = JSON.parse(redisCached);
      this.cacheService.set('message_association', cacheKey, parsed);
      return parsed;
    }

    const campaignQuery: QueryResult = await this.pgPool.query(
      `SELECT c.id FROM campaigns c
       INNER JOIN campaigns_messages cm ON cm.campaign_id = c.id
       WHERE c.account_id = $1 AND c.name = $2 AND cm.message_id = $3 AND c.deleted_at IS NULL
       LIMIT 1`,
      [accountId, name, messageId],
    );

    let result: { campaignId?: number; automationId?: number } = {};
    if (campaignQuery.rows.length) {
      result = { campaignId: campaignQuery.rows[0].id };
    } else {
      const automationQuery: QueryResult = await this.pgPool.query(
        `SELECT id FROM automations
         WHERE account_id = $1 AND name = $2 AND deleted_at IS NULL AND steps::text LIKE $3
         LIMIT 1`,
        [accountId, name, `%"id": ${messageId}%`],
      );
      if (automationQuery.rows.length) {
        result = { automationId: automationQuery.rows[0].id };
      }
    }

    const expireInSeconds = result.campaignId || result.automationId ? 60 * 60 * 24 : 60 * 60;
    await this.redisClient.set(redisKey, JSON.stringify(result), 'EX', expireInSeconds);
    this.cacheService.set('message_association', cacheKey, result);

    return result;
  }

  async findEvent(name: string, accountId: number) {
    const cacheKey = `${accountId}:${name}`;

    // Check memory cache first
    const cachedEvent = this.cacheService.get<any>('custom_event', cacheKey);
    if (cachedEvent) {
      return cachedEvent;
    }

    // Check Redis cache
    const redisKey = `custom_event:${accountId}:${name}`;
    const customEvent = await this.redisClient.get(redisKey).then((value) => JSON.parse(value));
    if (customEvent) {
      // Update memory cache
      this.cacheService.set('custom_event', cacheKey, customEvent);
      return customEvent;
    }

    const customEventQuery: QueryResult = await this.pgPool.query(
      'SELECT * FROM custom_events WHERE name = $1::text AND account_id = $2',
      [name, accountId],
    );
    const event = customEventQuery.rows.length ? customEventQuery.rows[0] : null;

    // Update both Redis and memory cache
    const expireIn7Days = 60 * 60 * 24 * 7;
    await this.redisClient.set(redisKey, JSON.stringify(event), 'EX', expireIn7Days);
    this.cacheService.set('custom_event', cacheKey, event);

    return event;
  }

  private prepareQuery<T extends Record<string, unknown>>(array: T[]): { keys: string[]; values: unknown[][] } {
    if (!array?.length) {
      this.formatterUtils.logInfo(`Array is empty or not provided: ${JSON.stringify(array)}`);
      return { keys: [], values: [] };
    }

    // Get all unique keys in a single pass. Skip internal-only fields
    // that don't map to an events_logs column:
    // - `delivered_id`: legacy join key carried on EventLog for Kafka only.
    // - `traits`: feeds BotDetector in processMessageToKafka; the six
    //   derived signals land in `properties` instead.
    const EXCLUDED_COLUMNS = new Set(['delivered_id', 'traits']);
    const keysMap = new Map<string, string>();
    array.forEach((item) => {
      Object.keys(item).forEach((key) => {
        const snakeKey = this.toSnakeCase(key);
        if (!keysMap.has(snakeKey) && !EXCLUDED_COLUMNS.has(snakeKey)) {
          keysMap.set(snakeKey, key);
        }
      });
    });

    const keys = Array.from(keysMap.keys());
    const originalKeys = Array.from(keysMap.values());

    // Create values array in a single pass
    const values = array.map((item) => originalKeys.map((key) => item[key] ?? null));

    return { keys, values };
  }

  private prepareUpdate(changes: ContactDeviceEditableAttributes | ContactEditableAttributes): string {
    return Object.keys(changes)
      .map((key) => {
        const snakeCaseKey = this.toSnakeCase(key);
        return format('%I = %L', snakeCaseKey, changes[key]);
      })
      .join(', ');
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2') // Handle consecutive uppercase letters
      .replace(/([a-z])([A-Z])/g, '$1_$2') // Handle camelCase
      .toLowerCase();
  }
}
