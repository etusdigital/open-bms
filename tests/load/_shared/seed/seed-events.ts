#!/usr/bin/env tsx
/**
 * Seed per-contact engagement summary columns (last_open, last_click,
 * last_sent) on the contacts table. Segment filters in this codebase read
 * from those columns; the row-level event log lives in ClickHouse and is
 * not populated here.
 *
 * --events-per-contact controls how many random event timestamps are rolled
 * per contact — only the MAX per event type lands on the contact row, so
 * higher values give a wider distribution of last_* timestamps.
 *
 *   pnpm tsx tests/load/_shared/seed/seed-events.ts \
 *     --contacts 10000 --events-per-contact 5 --account 1
 */

import { Client } from 'pg';

interface Args {
  contacts: number;
  eventsPerContact: number;
  account: number;
  batch: number;
  dsn: string;
}

function parseArgs(): Args {
  const out: any = { contacts: 10_000, eventsPerContact: 5, account: 1, batch: 1000 };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--contacts') out.contacts = Number(argv[++i]);
    else if (k === '--events-per-contact') out.eventsPerContact = Number(argv[++i]);
    else if (k === '--account') out.account = Number(argv[++i]);
    else if (k === '--batch') out.batch = Number(argv[++i]);
    else if (k === '--dsn') out.dsn = argv[++i];
  }
  out.dsn = out.dsn || process.env.PG_DSN || 'postgres://postgres:postgres@localhost:65432/msgops';
  return out;
}

const EVENT_TYPES = ['sent', 'delivered', 'open', 'click'];

async function main() {
  const args = parseArgs();
  const client = new Client({ connectionString: args.dsn });
  await client.connect();
  const t0 = Date.now();

  // Pull the contact id range the seeder created so we attach events to real rows.
  const { rows } = await client.query<{ min: string; max: string }>(
    `SELECT MIN(id)::text AS min, MAX(id)::text AS max FROM contacts WHERE account_id = $1`,
    [args.account],
  );
  const minId = Number(rows[0]?.min || 0);
  const maxId = Number(rows[0]?.max || 0);
  if (!maxId) throw new Error(`No contacts for account ${args.account} — run seed-contacts first.`);

  // Roll a per-contact MAX for each event type in-memory, then UPDATE in batches.
  const targets = new Map<number, { open?: Date; click?: Date; sent?: Date }>();
  for (let c = 0; c < args.contacts; c++) {
    const contactId = minId + (c % (maxId - minId + 1));
    const t = targets.get(contactId) ?? {};
    for (let e = 0; e < args.eventsPerContact; e++) {
      const event = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
      const ts = new Date(Date.now() - Math.floor(Math.random() * 30 * 86400_000));
      if (event === 'open' && (!t.open || ts > t.open)) t.open = ts;
      else if (event === 'click' && (!t.click || ts > t.click)) t.click = ts;
      else if (event === 'sent' && (!t.sent || ts > t.sent)) t.sent = ts;
    }
    targets.set(contactId, t);
  }

  let updated = 0;
  const entries = Array.from(targets.entries());
  for (let i = 0; i < entries.length; i += args.batch) {
    const chunk = entries.slice(i, i + args.batch);
    const placeholders: string[] = [];
    const values: any[] = [];
    chunk.forEach(([id, t], k) => {
      const base = k * 4;
      placeholders.push(`($${base + 1}::int, $${base + 2}::timestamptz, $${base + 3}::timestamptz, $${base + 4}::timestamptz)`);
      values.push(id, t.open || null, t.click || null, t.sent || null);
    });
    await client.query(
      `UPDATE contacts c SET
         last_open  = COALESCE(v.last_open,  c.last_open),
         last_click = COALESCE(v.last_click, c.last_click),
         last_sent  = COALESCE(v.last_sent,  c.last_sent)
       FROM (VALUES ${placeholders.join(',')}) AS v(id, last_open, last_click, last_sent)
       WHERE c.id = v.id AND c.account_id = $${values.length + 1}`,
      [...values, args.account],
    );
    updated += chunk.length;
  }

  const dt = Date.now() - t0;
  console.error(`[seed-events] updated ${updated} contacts (${args.eventsPerContact} rolls each) in ${dt}ms`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
