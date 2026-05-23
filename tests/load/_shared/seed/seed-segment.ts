#!/usr/bin/env tsx
/**
 * Insert a minimal segment row (tags table) with `segment_info` representing
 * either a simple single-condition filter or a complex multi-condition one.
 * EVO-1073 uses these as inputs for tag-process segment evaluation.
 *
 *   pnpm tsx tests/load/_shared/seed/seed-segment.ts \
 *     --account 1 --complexity simple --name "load simple"
 *
 * complexity:
 *   simple  → contacts where last_open >= 30d ago
 *   complex → 5-condition AND/OR mix on last_open, last_click, is_active, country, has_email
 */

import { Client } from 'pg';

function parseArgs() {
  const out: any = { account: 1, complexity: 'simple', name: 'load-segment' };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--account') out.account = Number(argv[++i]);
    else if (k === '--complexity') out.complexity = argv[++i];
    else if (k === '--name') out.name = argv[++i];
    else if (k === '--dsn') out.dsn = argv[++i];
  }
  out.dsn = out.dsn || process.env.PG_DSN || 'postgres://postgres:postgres@localhost:65432/msgops';
  return out;
}

const SIMPLE_SEGMENT = {
  conditions: [{ field: 'last_open', operator: 'gte', value: '30d_ago' }],
};

const COMPLEX_SEGMENT = {
  operator: 'AND',
  conditions: [
    { field: 'is_active', operator: 'eq', value: true },
    { field: 'last_open', operator: 'gte', value: '30d_ago' },
    {
      operator: 'OR',
      conditions: [
        { field: 'last_click', operator: 'gte', value: '7d_ago' },
        { field: 'country', operator: 'in', value: ['BR', 'US'] },
      ],
    },
    { field: 'has_email', operator: 'eq', value: true },
  ],
};

async function main() {
  const args = parseArgs();
  const client = new Client({ connectionString: args.dsn });
  await client.connect();

  const segmentInfo = args.complexity === 'complex' ? COMPLEX_SEGMENT : SIMPLE_SEGMENT;

  const res = await client.query<{ id: number }>(
    `INSERT INTO tags (account_id, name, description, type, is_real_time_segment, segment_info, steps, recurrence)
     VALUES ($1, $2, $3, 'segment', true, $4::json, '[]'::json, 0)
     RETURNING id`,
    [args.account, args.name, `Load test segment (${args.complexity})`, JSON.stringify(segmentInfo)],
  );

  console.error(`[seed-segment] created tag id=${res.rows[0].id} name="${args.name}" complexity=${args.complexity}`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
