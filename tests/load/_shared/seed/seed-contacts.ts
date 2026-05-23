#!/usr/bin/env tsx
/**
 * Direct-PG contact seeder. Bypasses the API to hit the 10k-contacts-in-30s
 * AC; the API path is gated by validation + tag/custom-field side-effects and
 * adds ~5x overhead at scale.
 *
 * Usage:
 *   pnpm tsx tests/load/_shared/seed/seed-contacts.ts \
 *     --count 10000 --account 1 --batch 500
 *
 * Columns mirror the NOT NULL set declared in
 * apps/msgops-api/src/migrations/1646740442417-create_table_contacts.ts plus
 * the `uuid` column added later (1665029405453).
 */

import { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';

interface Args {
  count: number;
  account: number;
  batch: number;
  dsn: string;
  prefix: string;
}

function parseArgs(): Args {
  const out: any = { count: 10_000, account: 1, batch: 500, prefix: 'load' };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--count') out.count = Number(argv[++i]);
    else if (k === '--account') out.account = Number(argv[++i]);
    else if (k === '--batch') out.batch = Number(argv[++i]);
    else if (k === '--dsn') out.dsn = argv[++i];
    else if (k === '--prefix') out.prefix = argv[++i];
  }
  out.dsn = out.dsn || process.env.PG_DSN || 'postgres://postgres:postgres@localhost:65432/msgops';
  return out;
}

async function main() {
  const args = parseArgs();
  const client = new Client({ connectionString: args.dsn });
  await client.connect();

  const t0 = Date.now();
  let inserted = 0;

  for (let offset = 0; offset < args.count; offset += args.batch) {
    const size = Math.min(args.batch, args.count - offset);
    const cols = [
      'account_id', 'uuid', 'email', 'email_provider', 'first_name', 'hashed_email',
      'is_active', 'is_unsubscribed', 'has_bounced', 'created_at', 'created_at_date',
    ];
    const placeholders: string[] = [];
    const values: any[] = [];
    for (let i = 0; i < size; i++) {
      const id = offset + i;
      const email = `${args.prefix}-${args.account}-${id}@example.com`;
      const row = [
        args.account,
        randomUUID(),
        email,
        'example.com',
        `Load${id}`,
        createHash('sha256').update(email.toLowerCase()).digest('hex'),
        true,
        false,
        false,
        new Date(),
        new Date().toISOString().slice(0, 10),
      ];
      const base = i * cols.length;
      placeholders.push('(' + row.map((_, k) => `$${base + k + 1}`).join(',') + ')');
      values.push(...row);
    }
    const sql = `INSERT INTO contacts (${cols.join(',')}) VALUES ${placeholders.join(',')}
                 ON CONFLICT ON CONSTRAINT contact_email_unique DO NOTHING`;
    await client.query(sql, values);
    inserted += size;
    if (offset % (args.batch * 10) === 0) {
      console.error(`[seed-contacts] ${inserted}/${args.count} (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
  }

  const dt = Date.now() - t0;
  console.error(`[seed-contacts] done: ${inserted} contacts in ${dt}ms (${(inserted / (dt / 1000)).toFixed(0)}/s)`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
