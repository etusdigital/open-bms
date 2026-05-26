import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClickhouseProvider } from '../../providers/clickhouse.provider';
import { AccountEntity } from '../../entities/account.entity';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { buildWhereClauses, extractAccountNameLookups, parseActivityQuery } from './filter-parser';

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
  page: number;
  limit: number;
  hasNext: boolean;
  appliedRange: { after: string; before: string };
}

@Injectable()
export class ActivityService {
  constructor(
    private readonly clickhouse: ClickhouseProvider,
    @InjectRepository(AccountEntity)
    private readonly accountsRepo: Repository<AccountEntity>,
  ) {}

  async queryEvents(dto: ActivityQueryDto): Promise<ActivityQueryResult> {
    const limit = Math.max(1, Math.min(200, Number(dto.limit) || 50));
    const page = Math.max(1, Math.min(10_000, Number(dto.page) || 1));
    const offset = (page - 1) * limit;

    const filter = parseActivityQuery(dto.q ?? '');

    const accountNames = extractAccountNameLookups(filter);
    const accountIdResolutions = await this.resolveAccountNames(accountNames);

    const built = buildWhereClauses(filter, {
      defaultDays: 7,
      capDays: 90,
      fixedMessageType: 'email',
      accountIdResolutions,
    });

    const sql = `
      SELECT ${PROJECTED_COLUMNS}
      FROM events_logs_v2
      WHERE ${built.whereSql}
      ORDER BY time DESC, events_logs_id DESC
      LIMIT ${limit + 1} OFFSET ${offset}
    `;

    const rows = await this.clickhouse.runQuery(sql);

    const hasNext = rows.length > limit;
    const events = hasNext ? rows.slice(0, limit) : rows;

    return { events, page, limit, hasNext, appliedRange: built.appliedRange };
  }

  private async resolveAccountNames(names: string[]): Promise<Map<string, number[] | null>> {
    const map = new Map<string, number[] | null>();
    if (names.length === 0) return map;
    // Per-token ILIKE so each token's match set is independent. Cap at 100
    // matches/token to keep the IN list bounded.
    await Promise.all(
      names.map(async (name) => {
        const rows = await this.accountsRepo
          .createQueryBuilder('account')
          .select(['account.id'])
          .where('account.name ILIKE :q', { q: `%${name}%` })
          .limit(100)
          .getMany();
        map.set(name, rows.length ? rows.map((r) => r.id) : null);
      }),
    );
    return map;
  }
}
