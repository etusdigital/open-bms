import { Injectable } from '@nestjs/common';
import { ClickhouseProvider } from '../../providers/clickhouse.provider';
import { ActivityQueryDto, decodeCursor, encodeCursor } from './dto/activity-query.dto';
import { buildWhereClauses, escape, parseActivityQuery } from './filter-parser';

const PROJECTED_COLUMNS = [
  'time',
  'time_date',
  'account_id',
  'message_type',
  'event',
  'contact_id',
  'automation_id',
  'campaign_id',
  'message_id',
  'email',
  'provider',
  'provider_account',
  'uuid',
  'url',
  'reason',
  'ip',
  'user_agent',
  'country',
  'region',
  'city',
  'properties',
  'events_logs_id',
].join(', ');

export interface ActivityQueryResult {
  events: any[];
  nextCursor: string | null;
  appliedRange: { after: string; before: string };
}

@Injectable()
export class ActivityService {
  constructor(private readonly clickhouse: ClickhouseProvider) {}

  async queryEvents(dto: ActivityQueryDto): Promise<ActivityQueryResult> {
    const limit = Math.max(1, Math.min(200, Number(dto.limit) || 50));

    const filter = parseActivityQuery(dto.q ?? '');
    const built = buildWhereClauses(filter, {
      defaultDaysWithAccount: 30,
      defaultDaysWithoutAccount: 7,
      capDays: 90,
      fixedMessageType: 'email',
    });

    const where = [built.whereSql];
    if (dto.cursor) {
      const cur = decodeCursor(dto.cursor);
      // Tuple comparison maintains the same total order as ORDER BY (time, events_logs_id) DESC.
      where.push(`(time, events_logs_id) < ('${escape(cur.time)}', ${Number(cur.id)})`);
    }

    const sql = `
      SELECT ${PROJECTED_COLUMNS}
      FROM events_logs_v2
      WHERE ${where.join(' AND ')}
      ORDER BY time DESC, events_logs_id DESC
      LIMIT ${limit + 1}
    `;

    const rows = await this.clickhouse.runQuery(sql);

    let nextCursor: string | null = null;
    let events = rows;
    if (rows.length > limit) {
      events = rows.slice(0, limit);
      const last = events[events.length - 1];
      nextCursor = encodeCursor({
        time: typeof last.time === 'string' ? last.time : String(last.time),
        id: String(last.events_logs_id),
      });
    }

    return { events, nextCursor, appliedRange: built.appliedRange };
  }
}
