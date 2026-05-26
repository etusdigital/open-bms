import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export const VALID_TOKENS = ['account', 'contact', 'campaign', 'automation', 'event', 'provider', 'after', 'before'] as const;
export type ValidToken = (typeof VALID_TOKENS)[number];

export interface FilterToken {
  key: ValidToken;
  values: string[];
  negate: boolean;
}

export interface ActivityFilter {
  tokens: FilterToken[];
  freeText: string[];
}

export interface BuildOptions {
  defaultDaysWithAccount: number;
  defaultDaysWithoutAccount: number;
  capDays: number;
  fixedMessageType: string;
}

export interface BuildResult {
  whereSql: string;
  fragments: string[];
  appliedRange: { after: string; before: string };
}

// ClickHouse string literals treat backslash as an escape character, so both
// backslashes and single quotes must be neutralized.
export const escape = (v: string) => v.replace(/\\/g, '\\\\').replace(/'/g, "''");

const VALID_SET = new Set<string>(VALID_TOKENS);

export class FilterParseError extends Error {}

export function parseActivityQuery(q: string): ActivityFilter {
  const tokens: FilterToken[] = [];
  const freeText: string[] = [];
  const raw = (q ?? '').trim();
  if (!raw) return { tokens, freeText };

  const parts = raw.split(/\s+/);
  const grouped = new Map<string, FilterToken>();

  for (const part of parts) {
    let negate = false;
    let body = part;
    if (body.startsWith('-')) {
      negate = true;
      body = body.slice(1);
    }
    const colon = body.indexOf(':');
    if (colon < 0) {
      if (!negate) freeText.push(body);
      continue;
    }
    const key = body.slice(0, colon);
    const value = body.slice(colon + 1);
    if (!VALID_SET.has(key)) {
      throw new FilterParseError(`Unknown token "${key}". Valid tokens: ${VALID_TOKENS.join(', ')}`);
    }
    if (!value) {
      throw new FilterParseError(`Token "${key}" requires a value`);
    }
    const groupKey = `${negate ? '!' : ''}${key}`;
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.values.push(value);
    } else {
      const token: FilterToken = { key: key as ValidToken, values: [value], negate };
      grouped.set(groupKey, token);
      tokens.push(token);
    }
  }

  return { tokens, freeText };
}

function quoteList(values: string[]): string {
  return values.map((v) => `'${escape(v)}'`).join(', ');
}

function buildContactClause(values: string[], negate: boolean): string {
  // contact: accepts email | numeric id | uuid string. Group each into its column.
  const emails: string[] = [];
  const ids: string[] = [];
  const uuids: string[] = [];
  for (const v of values) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) emails.push(v);
    else if (/^\d+$/.test(v)) ids.push(v);
    else uuids.push(v);
  }
  const ors: string[] = [];
  if (emails.length) ors.push(`email IN (${quoteList(emails)})`);
  if (ids.length) ors.push(`contact_id IN (${ids.map((n) => Number(n)).join(', ')})`);
  if (uuids.length) ors.push(`uuid IN (${quoteList(uuids)})`);
  const joined = ors.length === 1 ? ors[0] : `(${ors.join(' OR ')})`;
  return negate ? `NOT ${joined}` : joined;
}

function buildIntColumnClause(column: string, values: string[], negate: boolean): string {
  const nums = values.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      throw new FilterParseError(`Token "${column}" expects integer, got "${v}"`);
    }
    return n;
  });
  if (nums.length === 1) {
    return `${column} ${negate ? '!=' : '='} ${nums[0]}`;
  }
  return `${column} ${negate ? 'NOT IN' : 'IN'} (${nums.join(', ')})`;
}

function buildStringColumnClause(column: string, values: string[], negate: boolean): string {
  if (values.length === 1) {
    return `${column} ${negate ? '!=' : '='} '${escape(values[0])}'`;
  }
  return `${column} ${negate ? 'NOT IN' : 'IN'} (${quoteList(values)})`;
}

function parseDate(value: string, tokenName: string): dayjs.Dayjs {
  const d = dayjs(value);
  if (!d.isValid()) {
    throw new FilterParseError(`Token "${tokenName}" expects ISO date/datetime, got "${value}"`);
  }
  return d;
}

export function buildWhereClauses(filter: ActivityFilter, opts: BuildOptions): BuildResult {
  const where: string[] = [`message_type = '${escape(opts.fixedMessageType)}'`];
  let afterDate: dayjs.Dayjs | null = null;
  let beforeDate: dayjs.Dayjs | null = null;
  let hasAccount = false;

  for (const t of filter.tokens) {
    switch (t.key) {
      case 'account':
        hasAccount = true;
        where.push(buildIntColumnClause('account_id', t.values, t.negate));
        break;
      case 'campaign':
        where.push(buildIntColumnClause('campaign_id', t.values, t.negate));
        break;
      case 'automation':
        where.push(buildIntColumnClause('automation_id', t.values, t.negate));
        break;
      case 'event':
        where.push(buildStringColumnClause('event', t.values, t.negate));
        break;
      case 'provider':
        where.push(buildStringColumnClause('provider', t.values, t.negate));
        break;
      case 'contact':
        where.push(buildContactClause(t.values, t.negate));
        break;
      case 'after':
        // Last value wins; negation is meaningless for date bounds.
        afterDate = parseDate(t.values[t.values.length - 1], 'after');
        break;
      case 'before':
        beforeDate = parseDate(t.values[t.values.length - 1], 'before');
        break;
    }
  }

  const now = dayjs();
  const cap = now.subtract(opts.capDays, 'day');
  if (!afterDate && !beforeDate) {
    const days = hasAccount ? opts.defaultDaysWithAccount : opts.defaultDaysWithoutAccount;
    afterDate = now.subtract(days, 'day');
    beforeDate = now;
  } else if (!afterDate) {
    afterDate = cap;
  } else if (!beforeDate) {
    beforeDate = now;
  }

  if (afterDate.isBefore(cap)) afterDate = cap;

  // `time` is stored UTC in ClickHouse (server TZ also UTC), so always format
  // in UTC — otherwise a container in a non-UTC TZ silently shrinks the window.
  const afterUtc = afterDate.utc();
  const beforeUtc = beforeDate.utc();
  // Bound `time_date` (partition key) for pruning and `time` for precision.
  where.push(`time_date >= '${escape(afterUtc.format('YYYY-MM-DD'))}'`);
  where.push(`time_date <= '${escape(beforeUtc.format('YYYY-MM-DD'))}'`);
  where.push(`time >= '${escape(afterUtc.format('YYYY-MM-DD HH:mm:ss'))}'`);
  where.push(`time <= '${escape(beforeUtc.format('YYYY-MM-DD HH:mm:ss'))}'`);

  return {
    whereSql: where.join(' AND '),
    fragments: where,
    appliedRange: {
      after: afterDate.toISOString(),
      before: beforeDate.toISOString(),
    },
  };
}
