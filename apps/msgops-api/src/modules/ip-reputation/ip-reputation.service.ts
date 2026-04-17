import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpReputationDailyEntity } from 'src/entities/ip-reputation-daily.entity';
import { ClickhouseProvider } from 'src/providers/clickhouse.provider';

@Injectable()
export class IpReputationService {
  constructor(
    @InjectRepository(IpReputationDailyEntity)
    private readonly ipReputationRepository: Repository<IpReputationDailyEntity>,
    private readonly clickhouseProvider: ClickhouseProvider,
  ) {}

  async syncFromClickhouse(): Promise<{ inserted: number }> {
    const rows = await this.clickhouseProvider.runQuery(this.getClickhouseQuery());

    if (!rows.length) {
      return { inserted: 0 };
    }

    const queryRunner = this.ipReputationRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const batchSize = 1000;
      let totalInserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await this.batchInsert(batch, queryRunner);
        totalInserted += batch.length;
      }

      await queryRunner.commitTransaction();
      return { inserted: totalInserted };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  private async batchInsert(
    records: Array<{
      date: string;
      account_id: string;
      provider_account: string;
      pool: string;
      ip: string;
      delivered: string;
      open: string;
      click: string;
      deferred: string;
      bounce: string;
      spamreport: string;
      unsubscribe: string;
    }>,
    queryRunner: any,
  ): Promise<void> {
    const columnsCount = 12;
    const valuesIndex = records
      .map((_, index) => {
        const offset = index * columnsCount;
        return `(${Array.from({ length: columnsCount }, (__, i) => `$${1 + offset + i}`).join(', ')})`;
      })
      .join(',');

    const parameters = records.flatMap((row) => [
      row.date,
      parseInt(row.account_id) || 0,
      row.provider_account || null,
      row.pool || null,
      (row.ip || '').replace('::ffff:', ''),
      parseInt(row.delivered) || 0,
      parseInt(row.open) || 0,
      parseInt(row.click) || 0,
      parseInt(row.deferred) || 0,
      parseInt(row.bounce) || 0,
      parseInt(row.spamreport) || 0,
      parseInt(row.unsubscribe) || 0,
    ]);

    const query = `
      INSERT INTO ip_reputation_daily (date, account_id, provider_account, pool, ip, delivered, open, click, deferred, bounce, spam_report, unsubscribe)
      VALUES ${valuesIndex}
      ON CONFLICT (date, account_id, provider_account, pool, ip)
      DO UPDATE SET
        delivered = EXCLUDED.delivered,
        open = EXCLUDED.open,
        click = EXCLUDED.click,
        deferred = EXCLUDED.deferred,
        bounce = EXCLUDED.bounce,
        spam_report = EXCLUDED.spam_report,
        unsubscribe = EXCLUDED.unsubscribe
    `;

    await queryRunner.manager.query(query, parameters);
  }

  private getClickhouseQuery(): string {
    const dateFilter = 'today() - 1';
    const timeDateMin = 'today() - 2';

    return `
    WITH delivered_d1 AS
      (
          SELECT
              date,
              account_id,
              provider_account,
              pool,
              ip,
              count() AS delivered
          FROM events_logs_v2
          WHERE event = 'delivered'
            AND message_type = 'email'
            AND time_date >= ${timeDateMin}
            AND date = ${dateFilter}
            AND account_id != 0
          GROUP BY
              date,
              account_id,
              provider_account,
              pool,
              ip
      ),

      related_events AS
      (
          SELECT
              date,
              event,
              delivered_id
          FROM events_logs_v2
          WHERE event IN ('open', 'click', 'deferred', 'bounce', 'spamreport', 'unsubscribe')
            AND message_type = 'email'
            AND account_id != 0
            AND time_date >= ${timeDateMin}
            AND date = ${dateFilter}
      ),

      delivered_lookup AS
      (
          SELECT
              delivered_id,
              account_id,
              provider_account,
              pool,
              ip
          FROM events_logs_v2
          WHERE event = 'delivered'
            AND message_type = 'email'
            AND account_id != 0
            AND delivered_id IN (SELECT delivered_id FROM related_events)
      ),

      events_aggregated AS
      (
          SELECT
              e.date,
              d.account_id,
              d.provider_account,
              d.pool,
              d.ip,
              countIf(e.event = 'open') AS open,
              countIf(e.event = 'click') AS click,
              countIf(e.event = 'deferred') AS deferred,
              countIf(e.event = 'bounce') AS bounce,
              countIf(e.event = 'spamreport') AS spamreport,
              countIf(e.event = 'unsubscribe') AS unsubscribe
          FROM related_events e
          ANY LEFT JOIN delivered_lookup d
              ON e.delivered_id = d.delivered_id
          GROUP BY
              e.date,
              d.account_id,
              d.provider_account,
              d.pool,
              d.ip
      )

      SELECT
          coalesce(d.date, e.date) AS date,
          coalesce(d.account_id, e.account_id) AS account_id,
          coalesce(d.provider_account, e.provider_account) AS provider_account,
          coalesce(d.pool, e.pool) AS pool,
          coalesce(d.ip, e.ip) AS ip,
          d.delivered,
          e.open,
          e.click,
          e.deferred,
          e.bounce,
          e.spamreport,
          e.unsubscribe
      FROM delivered_d1 d
      FULL OUTER JOIN events_aggregated e
          ON d.date = e.date
         AND d.account_id = e.account_id
         AND d.provider_account = e.provider_account
         AND d.pool = e.pool
         AND d.ip = e.ip
      HAVING date != '1970-01-01'
    `;
  }
}
