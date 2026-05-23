#!/usr/bin/env node
/**
 * Read k6 JSON summary + sidecar CSVs and emit the markdown row format the
 * EVO-1442 children expect (Volume / Ambiente / RAM peak / CPU peak / p95 / Status).
 *
 *   node tests/load/_shared/report/report.mjs \
 *     --k6 tests/load/_shared/k6/out/summary.json \
 *     --docker tests/load/_shared/k6/out/docker-stats.csv \
 *     --label "1k contacts" --env "local" \
 *     >> tests/load/evo-1071-contact-ingest/REPORT.md
 *
 * Pass --k6-csv path/to/k6.csv instead of --k6 to derive p95 from a raw k6 CSV
 * output (when --out json wasn't used).
 */

import { readFileSync } from 'node:fs';

const args = parseArgs(process.argv.slice(2));

const p95 = args.k6 ? p95FromSummary(args.k6) : p95FromCsv(args.k6csv);
const errorRate = args.k6 ? errorRateFromSummary(args.k6) : null;
const peaks = peaksFromDockerCsv(args.docker);

const status = decideStatus({ p95, errorRate });

const row = [
  args.label || '',
  args.env || '',
  peaks.ramMb != null ? `${peaks.ramMb.toFixed(0)} MB` : 'n/a',
  peaks.cpuPct != null ? `${peaks.cpuPct.toFixed(1)} %` : 'n/a',
  p95 != null ? `${(p95 / 1000).toFixed(2)} s` : 'n/a',
  status,
];

// Print header only if --with-header passed (lets callers append rows to an
// existing table without re-emitting the header).
if (args['with-header']) {
  console.log('| Volume | Ambiente | RAM peak | CPU peak | p95 | Status |');
  console.log('|---|---|---|---|---|---|');
}
console.log('| ' + row.join(' | ') + ' |');

function p95FromSummary(path) {
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const m = j?.metrics?.http_req_duration;
  // --summary-export flattens fields onto the metric; handleSummary() in user
  // code can nest them under `.values`. Accept both.
  return m?.['p(95)'] ?? m?.values?.['p(95)'] ?? null;
}

function errorRateFromSummary(path) {
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const m = j?.metrics?.http_req_failed;
  return m?.rate ?? m?.values?.rate ?? null;
}

function p95FromCsv(path) {
  if (!path) return null;
  const lines = readFileSync(path, 'utf8').trim().split('\n');
  const header = lines.shift().split(',');
  const metricCol = header.indexOf('metric_name');
  const valueCol = header.indexOf('metric_value');
  const samples = [];
  for (const l of lines) {
    const parts = l.split(',');
    if (parts[metricCol] === 'http_req_duration') {
      const v = Number(parts[valueCol]);
      if (Number.isFinite(v)) samples.push(v);
    }
  }
  if (!samples.length) return null;
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length * 0.95)];
}

function peaksFromDockerCsv(path) {
  const out = { ramMb: null, cpuPct: null };
  if (!path) return out;
  const lines = readFileSync(path, 'utf8').trim().split('\n');
  lines.shift(); // header
  for (const l of lines) {
    const [, , cpu, mem] = l.split(',');
    const c = Number(cpu);
    const m = Number(mem);
    if (Number.isFinite(c)) out.cpuPct = Math.max(out.cpuPct ?? 0, c);
    if (Number.isFinite(m)) out.ramMb = Math.max(out.ramMb ?? 0, m);
  }
  return out;
}

function decideStatus({ p95, errorRate }) {
  if (p95 == null) return '⚠️ no-data';
  if (p95 > 5000) return '🛑 limit-reached';
  if (errorRate != null && errorRate > 0.01) return '🛑 limit-reached';
  return '✅ ok';
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const next = argv[i + 1];
      if (next == null || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}
