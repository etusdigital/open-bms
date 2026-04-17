/**
 * Backfill tb_email_hourly_stats from events_logs_v2 in weekly chunks.
 *
 * Workflow:
 *   1. Dry-run to estimate scope:
 *      pnpm tsx scripts/backfill-hourly-stats.ts --dry-run
 *
 *   2. Backfill historical data (defaults to last 90 days → yesterday):
 *      pnpm tsx scripts/backfill-hourly-stats.ts
 *
 *   3. Stop msgops-event-process, then backfill today:
 *      pnpm tsx scripts/backfill-hourly-stats.ts --today
 *
 *   4. Create the MV (004_create_hourly_stats_mv.sql), then restart msgops-event-process.
 *      New events flow into the MV; historical + today are already backfilled.
 *
 * Options:
 *   --dry-run         Estimate row counts without inserting
 *   --from YYYY-MM-DD Start date (default: 90 days ago)
 *   --to   YYYY-MM-DD End date inclusive (default: yesterday)
 *   --today           Backfill only today (use after stopping event-process)
 *   --chunk-days N    Days per chunk (default: 7)
 *   --account-id ID   Backfill only this account
 *   --help            Show this help
 *
 * Reads ClickHouse credentials from apps/backoffice-api/.env or environment variables:
 *   CLICKHOUSE_HOST, CLICKHOUSE_USERNAME, CLICKHOUSE_PASSWORD, CLICKHOUSE_DATABASE
 */

import { createClient } from '@clickhouse/client-web';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────────────

interface Config {
  dryRun: boolean;
  today: boolean;
  from: string;      // YYYY-MM-DD
  to: string;        // YYYY-MM-DD (inclusive)
  chunkDays: number;
  accountId?: number;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    dryRun: false,
    today: false,
    from: '',
    to: '',
    chunkDays: 7,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--today':
        config.today = true;
        break;
      case '--from':
        config.from = args[++i];
        break;
      case '--to':
        config.to = args[++i];
        break;
      case '--chunk-days':
        config.chunkDays = parseInt(args[++i], 10);
        break;
      case '--account-id':
        config.accountId = parseInt(args[++i], 10);
        break;
      case '--help':
        console.log(`
Usage: pnpm tsx scripts/backfill-hourly-stats.ts [options]

Options:
  --dry-run         Estimate row counts without inserting
  --today           Backfill only today (stop event-process first!)
  --from YYYY-MM-DD Start date (default: 90 days ago)
  --to   YYYY-MM-DD End date inclusive (default: yesterday)
  --chunk-days N    Days per chunk (default: 7)
  --account-id ID   Backfill only this account
  --help            Show this help
        `);
        process.exit(0);
    }
  }

  // --today overrides from/to to just today (single chunk)
  if (config.today) {
    const todayStr = new Date().toISOString().slice(0, 10);
    config.from = todayStr;
    config.to = todayStr;
    config.chunkDays = 1;
  } else {
    // Defaults: last 90 days up to yesterday
    if (!config.to) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      config.to = yesterday.toISOString().slice(0, 10);
    }
    if (!config.from) {
      const fromDate = new Date(config.to);
      fromDate.setDate(fromDate.getDate() - 89);
      config.from = fromDate.toISOString().slice(0, 10);
    }
  }

  return config;
}

// ─── Env loading ─────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const envVars: Record<string, string> = {};

  // Try to load from apps/backoffice-api/.env
  try {
    const envPath = resolve(__dirname, '..', 'apps', 'backoffice-api', '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      envVars[key] = value;
    }
  } catch {
    // .env not found, rely on process.env
  }

  // Process.env takes precedence
  return { ...envVars, ...process.env } as Record<string, string>;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function minDate(a: string, b: string): string {
  return a < b ? a : b;
}

interface Chunk {
  from: string;  // YYYY-MM-DD (inclusive)
  to: string;    // YYYY-MM-DD (exclusive, for < comparison)
}

function generateChunks(from: string, to: string, chunkDays: number): Chunk[] {
  const chunks: Chunk[] = [];
  let cursor = from;
  const endExclusive = addDays(to, 1); // to is inclusive, make it exclusive

  while (cursor < endExclusive) {
    const chunkEnd = minDate(addDays(cursor, chunkDays), endExclusive);
    chunks.push({ from: cursor, to: chunkEnd });
    cursor = chunkEnd;
  }

  return chunks;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const config = parseArgs();
  const env = loadEnv();

  const host = env.CLICKHOUSE_HOST;
  const username = env.CLICKHOUSE_USERNAME;
  const password = env.CLICKHOUSE_PASSWORD;
  const database = env.CLICKHOUSE_DATABASE;

  if (!host || !username || !database) {
    console.error('Missing ClickHouse credentials. Set CLICKHOUSE_HOST, CLICKHOUSE_USERNAME, CLICKHOUSE_PASSWORD, CLICKHOUSE_DATABASE');
    console.error('Or create apps/backoffice-api/.env with these values.');
    process.exit(1);
  }

  const client = createClient({
    url: host,
    username,
    password: password || '',
    database,
    request_timeout: 300_000, // 5 min per chunk
  });

  const accountFilter = config.accountId ? `AND account_id = ${config.accountId}` : '';
  const chunks = generateChunks(config.from, config.to, config.chunkDays);

  console.log('');
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`  Backfill tb_email_hourly_stats from events_logs_v2`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`  Mode:       ${config.dryRun ? 'DRY RUN (estimate only)' : 'LIVE INSERT'}${config.today ? ' (TODAY)' : ''}`);
  console.log(`  Range:      ${config.from} → ${config.to}`);
  console.log(`  Chunk size: ${config.chunkDays} day(s)`);
  console.log(`  Chunks:     ${chunks.length}`);
  console.log(`  Account:    ${config.accountId ?? 'all'}`);
  console.log(`  Host:       ${host}`);
  console.log(`  Database:   ${database}`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  if (config.today && !config.dryRun) {
    console.log('');
    console.log('  *** IMPORTANT: Make sure msgops-event-process is STOPPED ***');
    console.log('  *** before running --today to avoid duplicate counts.    ***');
  }
  console.log('');

  // ── Step 1: Global estimate ────────────────────────────────────────────────

  console.log('Estimating total source rows...');

  const countSql = `
    SELECT
      count() AS total_rows,
      formatReadableQuantity(total_rows) AS total_fmt,
      min(time) AS min_time,
      max(time) AS max_time,
      uniqExact(account_id) AS distinct_accounts,
      uniqExact(pool) AS distinct_pools
    FROM events_logs_v2
    WHERE message_type = 'email'
      AND time >= '${config.from} 00:00:00'
      AND time < '${addDays(config.to, 1)} 00:00:00'
      ${accountFilter}
  `;

  const countResult = await client.query({ query: countSql, format: 'JSONEachRow' });
  const [stats] = await countResult.json<{
    total_rows: string;
    total_fmt: string;
    min_time: string;
    max_time: string;
    distinct_accounts: string;
    distinct_pools: string;
  }>();

  if (!stats || stats.total_rows === '0') {
    console.log('No source data found for the given range. Nothing to do.');
    await client.close();
    return;
  }

  console.log(`  Source rows:      ${stats.total_fmt} (${stats.total_rows})`);
  console.log(`  Time range:       ${stats.min_time} → ${stats.max_time}`);
  console.log(`  Distinct accounts: ${stats.distinct_accounts}`);
  console.log(`  Distinct pools:    ${stats.distinct_pools}`);
  console.log('');

  // ── Step 2: Check existing data in target table ────────────────────────────

  console.log('Checking existing data in tb_email_hourly_stats...');

  try {
    const existingSql = `
      SELECT
        count() AS existing_rows,
        formatReadableQuantity(existing_rows) AS existing_fmt,
        min(hour) AS min_hour,
        max(hour) AS max_hour
      FROM tb_email_hourly_stats
      WHERE hour >= '${config.from} 00:00:00'
        AND hour < '${addDays(config.to, 1)} 00:00:00'
        ${accountFilter}
    `;

    const existingResult = await client.query({ query: existingSql, format: 'JSONEachRow' });
    const [existing] = await existingResult.json<{
      existing_rows: string;
      existing_fmt: string;
      min_hour: string;
      max_hour: string;
    }>();

    if (existing && existing.existing_rows !== '0') {
      console.log(`  WARNING: Target table already has ${existing.existing_fmt} rows in this range`);
      console.log(`           (${existing.min_hour} → ${existing.max_hour})`);
      console.log(`  SummingMergeTree will merge duplicates on the same key, but counts may inflate`);
      console.log(`  until OPTIMIZE TABLE runs. Consider truncating first if this is a re-run.`);
    } else {
      console.log('  Target table is empty for this range. Good.');
    }
  } catch (err: any) {
    if (err?.message?.includes('Unknown table')) {
      console.log('  Target table does not exist yet.');
      console.log('  Run 001_create_hourly_stats_table.sql first.');
      if (!config.dryRun) {
        console.log('  Cannot proceed with INSERT until the table is created.');
        await client.close();
        process.exit(1);
      }
    } else {
      throw err;
    }
  }
  console.log('');

  // ── Step 3: Process chunks ─────────────────────────────────────────────────

  let totalInserted = 0;
  const startTime = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkLabel = `[${i + 1}/${chunks.length}]`;

    if (config.dryRun) {
      // Estimate rows per chunk
      const estSql = `
        SELECT count() AS rows
        FROM events_logs_v2
        WHERE message_type = 'email'
          AND time >= '${chunk.from} 00:00:00'
          AND time < '${chunk.to} 00:00:00'
          ${accountFilter}
      `;

      const estResult = await client.query({ query: estSql, format: 'JSONEachRow' });
      const [est] = await estResult.json<{ rows: string }>();
      const rowCount = Number(est?.rows || 0);
      totalInserted += rowCount;

      console.log(`  ${chunkLabel} ${chunk.from} → ${chunk.to}  ~${rowCount.toLocaleString()} source rows`);
    } else {
      // Actual INSERT
      const chunkStart = Date.now();

      const insertSql = `
        INSERT INTO tb_email_hourly_stats
        SELECT
          toStartOfHour(time) AS hour,
          account_id,
          coalesce(pool, '') AS pool,
          coalesce(provider_account, '') AS provider_account,
          countIf(event = 'delivered') AS delivered,
          countIf(event IN ('bounce', 'bounced')) AS bounced,
          countIf(event = 'deferred') AS deferred,
          countIf(event = 'dropped') AS dropped,
          countIf(event = 'spamreport') AS spam_reported,
          countIf(event = 'open') AS opened,
          countIf(event = 'click') AS clicked,
          countIf(event IN ('unsubscribe', 'group_unsubscribe')) AS unsubscribed,
          count() AS total_events
        FROM events_logs_v2
        WHERE message_type = 'email'
          AND time >= '${chunk.from} 00:00:00'
          AND time < '${chunk.to} 00:00:00'
          ${accountFilter}
        GROUP BY hour, account_id, pool, provider_account
      `;

      await client.query({ query: insertSql });

      const elapsed = ((Date.now() - chunkStart) / 1000).toFixed(1);

      // Count what was inserted
      const verifySql = `
        SELECT count() AS rows
        FROM tb_email_hourly_stats
        WHERE hour >= '${chunk.from} 00:00:00'
          AND hour < '${chunk.to} 00:00:00'
          ${accountFilter}
      `;
      const verifyResult = await client.query({ query: verifySql, format: 'JSONEachRow' });
      const [verify] = await verifyResult.json<{ rows: string }>();
      const rowCount = Number(verify?.rows || 0);
      totalInserted += rowCount;

      console.log(`  ${chunkLabel} ${chunk.from} → ${chunk.to}  ${rowCount.toLocaleString()} rows  (${elapsed}s)`);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log(`───────────────────────────────────────────────────────────────`);
  if (config.dryRun) {
    console.log(`  DRY RUN complete: ~${totalInserted.toLocaleString()} source rows across ${chunks.length} chunks`);
    console.log(`  Estimated time: ${chunks.length * 5}–${chunks.length * 30}s (varies with volume)`);
    console.log(`  Run without --dry-run to execute the backfill.`);
  } else {
    console.log(`  Backfill complete: ${totalInserted.toLocaleString()} rows in ${totalElapsed}s`);
    console.log(`  Run OPTIMIZE TABLE tb_email_hourly_stats FINAL to merge parts.`);
  }
  console.log(`───────────────────────────────────────────────────────────────`);
  console.log('');

  await client.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
