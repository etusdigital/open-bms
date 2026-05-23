#!/usr/bin/env node
// Sidecar metrics collector. Runs in parallel with k6 and snapshots:
//   docker stats           → docker-stats.csv  (per-container RAM/CPU)
//   redis LLEN bull:*      → bull-queues.csv   (waiting/active/failed depth)
//   pg_stat_activity       → pg-activity.csv   (connection + slow-query count)
//
// Every row is timestamped with epoch-ms (UTC) so the report script can merge
// against k6 output on a common time axis.
//
// Usage:
//   node tests/load/_shared/metrics/collect.mjs --out tests/load/_shared/k6/out --interval 10000
//
// Stop with SIGINT (Ctrl-C); flushes pending writes on exit.

import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = resolve(args.out || './out');
const INTERVAL = Number(args.interval || 10_000);
const REDIS = args.redis || 'redis://localhost:16379';
const PG_DSN = args.pg || 'postgres://postgres:postgres@localhost:65432/msgops';
// Bull queue names — keep in sync with apps/msgops-api/src/providers/queue/queue.constants.ts.
const BULL_QUEUES = (args.queues || 'bms-scheduler-campaign-trigger,bms-scheduler-segment,bms-scheduler-bms-usage').split(',');

mkdirSync(OUT_DIR, { recursive: true });

const dockerCsv = openCsv(`${OUT_DIR}/docker-stats.csv`, ['ts', 'container', 'cpu_pct', 'mem_mb', 'mem_pct']);
const bullCsv = openCsv(`${OUT_DIR}/bull-queues.csv`, ['ts', 'queue', 'state', 'depth']);
const pgCsv = openCsv(`${OUT_DIR}/pg-activity.csv`, ['ts', 'active_connections', 'slow_queries']);

console.error(`[metrics] writing to ${OUT_DIR}, interval=${INTERVAL}ms`);

let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
  console.error('\n[metrics] SIGINT — flushing');
});
process.on('SIGTERM', () => {
  stopping = true;
});

(async function main() {
  while (!stopping) {
    const ts = Date.now();
    await Promise.allSettled([snapshotDocker(ts), snapshotBull(ts), snapshotPg(ts)]);
    await sleep(INTERVAL);
  }
  dockerCsv.end();
  bullCsv.end();
  pgCsv.end();
})();

async function snapshotDocker(ts) {
  const out = await run('docker', ['stats', '--no-stream', '--format', '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}']);
  for (const line of out.split('\n').filter(Boolean)) {
    const [name, cpu, mem, memPct] = line.split('|');
    const memMb = parseMemMb(mem?.split('/')[0]?.trim() || '');
    dockerCsv.write([ts, name, stripPct(cpu), memMb, stripPct(memPct)]);
  }
}

async function snapshotBull(ts) {
  for (const queue of BULL_QUEUES) {
    for (const state of ['waiting', 'active', 'failed', 'delayed']) {
      const key = `bull:${queue}:${state}`;
      const out = await run('redis-cli', ['-u', REDIS, 'LLEN', key]).catch(() => '0');
      bullCsv.write([ts, queue, state, Number(out.trim()) || 0]);
    }
  }
}

async function snapshotPg(ts) {
  // pg_stat_statements is an optional extension — `CREATE EXTENSION
  // pg_stat_statements;` (superuser) enables it. We probe and fall back to
  // just the active-connections count when it's not installed.
  const sql = `SELECT
    (SELECT count(*) FROM pg_stat_activity WHERE state='active') AS active,
    (SELECT COALESCE((SELECT count(*) FROM pg_stat_statements WHERE mean_exec_time > 1000), 0)) AS slow;`;
  const fallback = `SELECT count(*) FROM pg_stat_activity WHERE state='active';`;
  let out = await run('psql', [PG_DSN, '-Atc', sql]).catch(() => null);
  if (!out) out = await run('psql', [PG_DSN, '-Atc', fallback]).catch(() => null);
  if (!out) {
    pgCsv.write([ts, '', '']);
    return;
  }
  const parts = out.trim().split('|');
  pgCsv.write([ts, parts[0] || 0, parts[1] || 0]);
}

function openCsv(path, header) {
  const s = createWriteStream(path, { flags: 'w' });
  s.write(header.join(',') + '\n');
  return {
    write(row) {
      s.write(row.map(csvCell).join(',') + '\n');
    },
    end() {
      s.end();
    },
  };
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseMemMb(s) {
  // docker stats reports "123.4MiB" / "1.234GiB" / "456kB". Normalize to MB.
  const m = s.match(/^([\d.]+)\s*([kKmMgG])i?B$/);
  if (!m) return '';
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'k') return (n / 1024).toFixed(2);
  if (unit === 'm') return n.toFixed(2);
  if (unit === 'g') return (n * 1024).toFixed(2);
  return n.toFixed(2);
}

function stripPct(s) {
  return s ? s.replace('%', '').trim() : '';
}

function run(cmd, argv) {
  return new Promise((resolveP, rejectP) => {
    const p = spawn(cmd, argv);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolveP(out) : rejectP(new Error(err || `${cmd} exit ${code}`))));
    p.on('error', rejectP);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) {
      out[k.slice(2)] = true;
    } else {
      out[k.slice(2)] = next;
      i++;
    }
  }
  return out;
}
