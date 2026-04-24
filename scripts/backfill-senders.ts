/**
 * Backfill pool IPs and ip_assignments from ClickHouse events data.
 *
 * Queries ClickHouse for distinct (pool, account_id, ip) from delivered emails
 * in the last 90 days, then writes the mappings into PostgreSQL:
 *   - Updates pools.ip JSONB arrays
 *   - Creates ip_assignments rows
 *
 * Usage:
 *   pnpm tsx scripts/backfill-senders.ts --dry-run   # Preview changes
 *   pnpm tsx scripts/backfill-senders.ts              # Execute
 *
 * Options:
 *   --dry-run   Show what would be done without writing
 *   --help      Show this help
 *
 * Reads credentials from apps/backoffice-api/.env:
 *   CLICKHOUSE_HOST, CLICKHOUSE_USERNAME, CLICKHOUSE_PASSWORD, CLICKHOUSE_DATABASE
 *   TYPEORM_HOST, TYPEORM_PORT, TYPEORM_USERNAME, TYPEORM_PASSWORD, TYPEORM_DATABASE
 */

import { createClient } from '@clickhouse/client-web';
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────────────

interface Config {
  dryRun: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = { dryRun: false };

  for (const arg of args) {
    switch (arg) {
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--help':
        console.log(`
Usage: pnpm tsx scripts/backfill-senders.ts [options]

Options:
  --dry-run   Show what would be done without writing
  --help      Show this help
        `);
        process.exit(0);
    }
  }

  return config;
}

// ─── Env loading ─────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const envVars: Record<string, string> = {};

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

  return { ...envVars, ...process.env } as Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4) */
function normalizeIp(ip: string): string {
  const prefix = '::ffff:';
  if (ip.toLowerCase().startsWith(prefix)) {
    return ip.slice(prefix.length);
  }
  return ip;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const config = parseArgs();
  const env = loadEnv();

  // Validate ClickHouse credentials
  const chHost = env.CLICKHOUSE_HOST;
  const chUser = env.CLICKHOUSE_USERNAME;
  const chPass = env.CLICKHOUSE_PASSWORD;
  const chDb = env.CLICKHOUSE_DATABASE;

  if (!chHost || !chUser || !chDb) {
    console.error(
      'Missing ClickHouse credentials. Set CLICKHOUSE_HOST, CLICKHOUSE_USERNAME, CLICKHOUSE_PASSWORD, CLICKHOUSE_DATABASE',
    );
    process.exit(1);
  }

  // Validate PostgreSQL credentials
  const pgHost = env.TYPEORM_HOST;
  const pgPort = parseInt(env.TYPEORM_PORT || '5432', 10);
  const pgUser = env.TYPEORM_USERNAME;
  const pgPass = env.TYPEORM_PASSWORD;
  const pgDb = env.TYPEORM_DATABASE;

  if (!pgHost || !pgUser || !pgDb) {
    console.error(
      'Missing PostgreSQL credentials. Set TYPEORM_HOST, TYPEORM_PORT, TYPEORM_USERNAME, TYPEORM_PASSWORD, TYPEORM_DATABASE',
    );
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Backfill senders: pools.ip + ip_assignments from ClickHouse');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Mode:       ${config.dryRun ? 'DRY RUN (preview only)' : 'LIVE WRITE'}`);
  console.log(`  CH Host:    ${chHost}`);
  console.log(`  PG Host:    ${pgHost}:${pgPort}/${pgDb}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // ── Connect ClickHouse ───────────────────────────────────────────────────

  const ch = createClient({
    url: chHost,
    username: chUser,
    password: chPass || '',
    database: chDb,
    request_timeout: 120_000,
  });

  // ── Connect PostgreSQL ───────────────────────────────────────────────────

  const isLocalhost = pgHost === 'localhost' || pgHost === '127.0.0.1';
  const pgClient = new pg.Client({
    host: pgHost,
    port: pgPort,
    user: pgUser,
    password: pgPass || '',
    database: pgDb,
    ...(isLocalhost ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  await pgClient.connect();

  try {
    // ── Step 1: Query ClickHouse for distinct IP usage per pool ───────────

    console.log('Querying ClickHouse for IP usage in the last 90 days...');

    const chQuery = `
      SELECT
        pool,
        account_id,
        IPv6NumToString(ip) AS ip_address
      FROM events_logs_v2
      WHERE time_date >= today() - 90
        AND message_type = 'email'
        AND event = 'delivered'
        AND pool != ''
      GROUP BY pool, account_id, ip
    `;

    const chResult = await ch.query({ query: chQuery, format: 'JSONEachRow' });
    const chRows = await chResult.json<{
      pool: string;
      account_id: number;
      ip_address: string;
    }>();

    console.log(`  Found ${chRows.length} distinct (pool, account, ip) combinations`);
    console.log('');

    if (chRows.length === 0) {
      console.log('No data found. Nothing to do.');
      return;
    }

    // Normalize IPs
    for (const row of chRows) {
      row.ip_address = normalizeIp(row.ip_address);
    }

    // ── Step 2: Read PostgreSQL tables ─────────────────────────────────────

    console.log('Reading PostgreSQL tables...');

    const [poolsRes, accountsRes, ipsRes, assignmentsRes] = await Promise.all([
      pgClient.query('SELECT id, pool_name, account_id, ip, sender_email FROM pools WHERE deleted_at IS NULL'),
      pgClient.query('SELECT id, name FROM accounts'),
      pgClient.query('SELECT id, ip_address FROM ips'),
      pgClient.query('SELECT ip_id, pool_id FROM ip_assignments WHERE removed_at IS NULL'),
    ]);

    // Build lookup maps
    const poolsByNameAccount = new Map<
      string,
      { id: number; poolName: string; accountId: number; currentIps: string[]; senderEmail: string | null }
    >();
    for (const row of poolsRes.rows) {
      const key = `${row.pool_name}::${row.account_id}`;
      poolsByNameAccount.set(key, {
        id: row.id,
        poolName: row.pool_name,
        accountId: row.account_id,
        currentIps: Array.isArray(row.ip) ? row.ip : [],
        senderEmail: row.sender_email || null,
      });
    }

    const accountNames = new Map<number, string>();
    for (const row of accountsRes.rows) {
      accountNames.set(row.id, row.name);
    }

    const ipsByAddress = new Map<string, number>(); // ip_address → ip.id
    for (const row of ipsRes.rows) {
      ipsByAddress.set(row.ip_address, row.id);
    }

    const existingAssignments = new Set<string>(); // "ipId::poolId"
    for (const row of assignmentsRes.rows) {
      existingAssignments.add(`${row.ip_id}::${row.pool_id}`);
    }

    console.log(`  Pools:       ${poolsRes.rows.length}`);
    console.log(`  Accounts:    ${accountsRes.rows.length}`);
    console.log(`  IPs:         ${ipsRes.rows.length}`);
    console.log(`  Assignments: ${assignmentsRes.rows.length} (active)`);
    console.log('');

    // ── Step 3: Build update plan ──────────────────────────────────────────

    // Accumulate IPs per pool
    const poolIpSets = new Map<number, Set<string>>(); // poolId → Set<ipAddress>
    const newAssignments: {
      ipId: number;
      poolId: number;
      poolName: string;
      accountId: number;
      senderEmail: string | null;
    }[] = [];

    let skippedNoPool = 0;
    let skippedNoIp = 0;
    let skippedExisting = 0;

    for (const row of chRows) {
      const poolKey = `${row.pool}::${row.account_id}`;
      const pool = poolsByNameAccount.get(poolKey);
      if (!pool) {
        skippedNoPool++;
        continue;
      }

      const ipId = ipsByAddress.get(row.ip_address);
      if (!ipId) {
        skippedNoIp++;
        continue;
      }

      // Accumulate for pools.ip update
      if (!poolIpSets.has(pool.id)) {
        poolIpSets.set(pool.id, new Set(pool.currentIps));
      }
      poolIpSets.get(pool.id)!.add(row.ip_address);

      // Check if assignment already exists
      const assignmentKey = `${ipId}::${pool.id}`;
      if (existingAssignments.has(assignmentKey)) {
        skippedExisting++;
        continue;
      }

      newAssignments.push({
        ipId,
        poolId: pool.id,
        poolName: pool.poolName,
        accountId: pool.accountId,
        senderEmail: pool.senderEmail,
      });

      // Mark as existing to avoid duplicates within the same run
      existingAssignments.add(assignmentKey);
    }

    // Determine which pools actually need an ip column update
    const poolUpdates: { poolId: number; poolName: string; ips: string[] }[] = [];
    for (const [poolId, ipSet] of poolIpSets) {
      const pool = poolsRes.rows.find((r: any) => r.id === poolId);
      const currentIps = Array.isArray(pool?.ip) ? pool.ip : [];
      const newIps = [...ipSet].sort();

      // Only update if the set changed
      if (JSON.stringify(currentIps.sort()) !== JSON.stringify(newIps)) {
        poolUpdates.push({ poolId, poolName: pool?.pool_name, ips: newIps });
      }
    }

    // ── Step 4: Summary ────────────────────────────────────────────────────

    console.log('Plan:');
    console.log(`  Pool IP updates:     ${poolUpdates.length}`);
    console.log(`  New IP assignments:  ${newAssignments.length}`);
    console.log(`  Skipped (no pool):   ${skippedNoPool}`);
    console.log(`  Skipped (no IP):     ${skippedNoIp}`);
    console.log(`  Skipped (existing):  ${skippedExisting}`);
    console.log('');

    if (poolUpdates.length > 0) {
      console.log('Pool IP updates:');
      for (const u of poolUpdates) {
        console.log(`  pool #${u.poolId} (${u.poolName}): ${u.ips.join(', ')}`);
      }
      console.log('');
    }

    if (newAssignments.length > 0) {
      console.log('New IP assignments:');
      for (const a of newAssignments) {
        const ipAddr = ipsRes.rows.find((r: any) => r.id === a.ipId)?.ip_address ?? `ip#${a.ipId}`;
        const acctName = accountNames.get(a.accountId) ?? `account#${a.accountId}`;
        console.log(`  ${ipAddr} → ${a.poolName} (${acctName})`);
      }
      console.log('');
    }

    if (poolUpdates.length === 0 && newAssignments.length === 0) {
      console.log('Nothing to do — all data is already up to date.');
      return;
    }

    if (config.dryRun) {
      console.log('───────────────────────────────────────────────────────────────');
      console.log('  DRY RUN complete. Run without --dry-run to execute.');
      console.log('───────────────────────────────────────────────────────────────');
      return;
    }

    // ── Step 5: Write to PostgreSQL ────────────────────────────────────────

    console.log('Writing to PostgreSQL...');

    // Update pools.ip
    for (const u of poolUpdates) {
      await pgClient.query('UPDATE pools SET ip = $1 WHERE id = $2', [JSON.stringify(u.ips), u.poolId]);
    }
    console.log(`  Updated ${poolUpdates.length} pool(s)`);

    // Insert ip_assignments
    if (newAssignments.length > 0) {
      const values: any[] = [];
      const placeholders: string[] = [];
      let idx = 1;

      for (const a of newAssignments) {
        placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        values.push(
          a.ipId,
          a.poolId,
          a.poolName,
          a.accountId,
          a.senderEmail,
          'backfill-script',
          'Backfilled from ClickHouse events (last 90 days)',
        );
      }

      await pgClient.query(
        `INSERT INTO ip_assignments (ip_id, pool_id, pool_name, account_id, sender_email, assigned_by, notes)
         VALUES ${placeholders.join(', ')}`,
        values,
      );
      console.log(`  Inserted ${newAssignments.length} assignment(s)`);
    }

    console.log('');
    console.log('───────────────────────────────────────────────────────────────');
    console.log('  Backfill complete.');
    console.log('───────────────────────────────────────────────────────────────');
    console.log('');
  } finally {
    await pgClient.end();
    await ch.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
