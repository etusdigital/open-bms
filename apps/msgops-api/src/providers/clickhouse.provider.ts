import { Injectable, Logger } from '@nestjs/common';
import { createClient, ClickHouseClient } from '@clickhouse/client';

// Queries slower than this are logged at WARN level so they show up in
// log alerts and stand out in dev console. ClickHouse queries against the
// indexes we use should be < 500ms in steady state; anything beyond a
// second is worth investigating.
const SLOW_QUERY_THRESHOLD_MS = 1000;

@Injectable()
export class ClickhouseProvider {
  private readonly logger = new Logger(ClickhouseProvider.name);
  private client: ClickHouseClient;

  constructor() {
    this.client = createClient({
      host: process.env.CLICKHOUSE_HOST,
      username: process.env.CLICKHOUSE_USERNAME,
      password: process.env.CLICKHOUSE_PASSWORD,
      database: process.env.CLICKHOUSE_DATABASE,
      request_timeout: 60 * 60 * 1000,
    });
  }

  /**
   * Strict superset of the previous signature — `params` is optional so
   * existing callers without params keep working untouched. Uses JSONEachRow
   * (smaller payload, no wrapper metadata) and disables 64-bit-int quoting
   * — safe because BMS aggregates stay well below Number.MAX_SAFE_INTEGER.
   *
   * Logs the (compacted) SQL + execution time on every call. Queries that
   * exceed `SLOW_QUERY_THRESHOLD_MS` are logged at WARN level so they
   * stand out in Cloud Logging — actionable signal for the contact-history
   * endpoint, which has been observed taking 6-8s per page load.
   */
  async runQuery<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    const start = Date.now();
    try {
      const resultSet = await this.client.query({
        query: sql,
        query_params: params,
        format: 'JSONEachRow',
        clickhouse_settings: {
          output_format_json_quote_64bit_integers: 0,
        },
      });
      const rows = await resultSet.json<T>();
      this.logQuery(sql, params, rows.length, Date.now() - start, null);
      return rows;
    } catch (err) {
      this.logQuery(sql, params, 0, Date.now() - start, err);
      throw err;
    }
  }

  private logQuery(sql: string, params: Record<string, unknown> | undefined, rowCount: number, elapsedMs: number, error: unknown): void {
    const compactSql = sql.replace(/\s+/g, ' ').trim();
    const paramSummary = params ? JSON.stringify(params) : '∅';
    const verb = error ? 'failed' : `→ ${rowCount} rows`;
    const message = `[CH] ${elapsedMs}ms ${verb} · ${compactSql} · params=${paramSummary}`;
    if (error) {
      this.logger.error(message, error instanceof Error ? error.stack : String(error));
    } else if (elapsedMs >= SLOW_QUERY_THRESHOLD_MS) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}
