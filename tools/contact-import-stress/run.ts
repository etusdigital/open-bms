/**
 * Contact-import stress test runner.
 *
 * Sequential: one request at a time. We probe payload size, NOT concurrency. The
 * runner stops the matrix at the first non-4xx failure and (by default) bisects
 * between the last success and that failure to refine the limit.
 *
 *   pnpm tsx tools/contact-import-stress/run.ts --smoke
 *   pnpm tsx tools/contact-import-stress/run.ts
 *
 * Required env (load via `.env.stress` next to this file):
 *   STRESS_API_URL, STRESS_EMAIL, STRESS_PASSWORD, STRESS_ACCOUNT_ID
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generatePayload } from './payload-generator';
import { login, importContacts, AuthError } from './http-client';
import {
  ContainerMetricsCollector,
  type MetricsSnapshot,
} from './metrics-collector';
import { classify, type FailureClass } from './failure-classifier';
import { bisect, type BisectResult } from './bisect';
import { CsvWriter, type RunPhase, type RunRow } from './csv-writer';
import { generate as generateReport } from './report-writer';

const DEFAULT_SIZES = [100, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];
// Sentinel: when the user doesn't pass --seed, we synthesize a fresh
// time-based seed per run so each run inserts brand-new emails (otherwise
// the second smoke against the same DB hits "already exists" and the
// import path doesn't actually exercise the insert hot path).
// AC5 still holds: passing --seed N reproduces the same payload byte-for-byte.
const SEED_AUTO: number = Number.NaN;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_SAFETY_MARGIN = 0.7;
const DEFAULT_BISECT_STEP = 500;
const DEFAULT_CONTAINER = 'msgops-api';
const MAX_BISECT_ITER = 8;

const TOOL_DIR = __dirname;
// Reports live next to results/ in the tool dir. Filename embeds the run's
// ISO timestamp (date + time, ms-precision) so multiple runs in the same day
// don't collide.
function buildReportPath(startedAt: string): string {
  const ts = startedAt.replace(/[:.]/g, '-');
  return join(TOOL_DIR, 'reports', `report-${ts}.md`);
}

interface CliOptions {
  sizes: number[];
  seed: number;
  timeoutMs: number;
  safetyMargin: number;
  bisectStep: number;
  smoke: boolean;
  bisectEnabled: boolean;
  containerName: string;
  emailOverride: string | null;
  passwordOverride: string | null;
  accountIdOverride: string | null;
  apiUrlOverride: string | null;
}

function parseCli(argv: string[]): CliOptions {
  const opts: CliOptions = {
    sizes: [...DEFAULT_SIZES],
    seed: SEED_AUTO,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    safetyMargin: DEFAULT_SAFETY_MARGIN,
    bisectStep: DEFAULT_BISECT_STEP,
    smoke: false,
    bisectEnabled: true,
    containerName: DEFAULT_CONTAINER,
    emailOverride: null,
    passwordOverride: null,
    accountIdOverride: null,
    apiUrlOverride: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const eat = (): string => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return v;
    };
    switch (arg) {
      case '--sizes':
        opts.sizes = eat()
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const n = Number(s);
            if (!Number.isInteger(n) || n <= 0) {
              throw new Error(`--sizes: "${s}" is not a positive integer`);
            }
            return n;
          });
        break;
      case '--seed':
        opts.seed = parseIntOrThrow(eat(), '--seed');
        break;
      case '--timeout':
        opts.timeoutMs = parseIntOrThrow(eat(), '--timeout');
        break;
      case '--safety-margin':
        opts.safetyMargin = parseFloatOrThrow(eat(), '--safety-margin');
        // Floor at 0.1: anything tinier produces a meaningless `recommendedN`
        // (e.g. 0.000001 → 0) and is almost certainly a typo (F8).
        if (opts.safetyMargin < 0.1 || opts.safetyMargin > 1) {
          throw new Error('--safety-margin must be in [0.1, 1]');
        }
        break;
      case '--bisect-step':
        opts.bisectStep = parseIntOrThrow(eat(), '--bisect-step');
        break;
      case '--smoke':
        opts.smoke = true;
        break;
      case '--no-bisect':
        opts.bisectEnabled = false;
        break;
      case '--container':
        opts.containerName = eat();
        break;
      case '--email':
        opts.emailOverride = eat();
        break;
      case '--password':
        // Convenience for ad-hoc runs. The interactive prompt below is safer
        // (no shell history). Use this flag only when scripting.
        opts.passwordOverride = eat();
        break;
      case '--account-id':
        opts.accountIdOverride = eat();
        break;
      case '--api-url':
        opts.apiUrlOverride = eat();
        break;
      case '--help':
      case '-h':
        printHelpAndExit();
        break;
      default:
        throw new Error(`Unknown flag: ${arg}`);
    }
  }

  if (opts.smoke) {
    opts.sizes = [10];
    opts.bisectEnabled = false;
  }
  // F9: empty matrix is never useful; reject it instead of silently producing
  // a "no failures observed" report.
  if (opts.sizes.length === 0) {
    throw new Error('--sizes must contain at least one positive integer');
  }
  if (Number.isNaN(opts.seed)) {
    // Fold ms-resolution clock + a 16-bit random nonce into a 32-bit seed.
    // Two runs in the same ms still differ thanks to the nonce.
    opts.seed =
      (Date.now() & 0xffff_ffff) ^
      (Math.floor(Math.random() * 0x1_0000) << 16);
    opts.seed >>>= 0;
  }
  return opts;
}

function parseIntOrThrow(s: string, flag: string): number {
  const n = Number(s);
  if (!Number.isInteger(n)) throw new Error(`${flag}: "${s}" is not an integer`);
  return n;
}
function parseFloatOrThrow(s: string, flag: string): number {
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${flag}: "${s}" is not a number`);
  return n;
}

function printHelpAndExit(): never {
  process.stdout.write(`Contact-import stress runner

Usage:
  pnpm tsx tools/contact-import-stress/run.ts [flags]

Flags:
  --sizes "100,500,..."   Comma-separated matrix (default: ${DEFAULT_SIZES.join(',')})
  --seed <int>            PRNG seed. Default: time-based (unique per run, so
                          emails don't collide with previous runs in the same
                          DB). Pass a fixed integer to reproduce a payload.
  --timeout <ms>          Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --safety-margin <0..1>  Multiplier on firstFailN (default: ${DEFAULT_SAFETY_MARGIN})
  --bisect-step <int>     Stop bisecting when gap <= step (default: ${DEFAULT_BISECT_STEP})
  --smoke                 N=[10], no bisect — pipeline check (AC1)
  --no-bisect             Skip bisection
  --container <name>      Docker container observed (default: ${DEFAULT_CONTAINER})

Auth/target overrides (have priority over .env.stress):
  --api-url <url>         e.g. http://localhost:5001
  --email <addr>          Login email
  --password <pw>         Login password (UNSAFE: visible in shell history;
                          prefer the interactive prompt — leave it unset and
                          you'll be asked at runtime with no echo)
  --account-id <int>      Numeric account id sent as the Account-Id header

  -h, --help              Print this help

Env (.env.stress next to this script):
  STRESS_API_URL, STRESS_EMAIL, STRESS_PASSWORD, STRESS_ACCOUNT_ID
`);
  process.exit(0);
}

interface EnvConfig {
  apiUrl: string;
  email: string;
  password: string;
  accountId: string;
}

async function loadEnv(cli: CliOptions): Promise<EnvConfig> {
  const envFile = join(TOOL_DIR, '.env.stress');
  if (existsSync(envFile)) {
    const text = readFileSync(envFile, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1);
      const stripped = stripPairedQuotes(value);
      value = stripped.value;
      if (!stripped.wasQuoted) {
        // F10: inline `# comment` only when preceded by whitespace.
        const hashIdx = findInlineCommentStart(value);
        if (hashIdx >= 0) value = value.slice(0, hashIdx);
      }
      value = value.trim();
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }

  // CLI overrides have priority over both env file and shell env.
  const apiUrl = cli.apiUrlOverride ?? requiredOrPrompt('STRESS_API_URL', null);
  const email = cli.emailOverride ?? requiredOrPrompt('STRESS_EMAIL', null);
  const passwordFromCli = cli.passwordOverride;
  const password = passwordFromCli ?? process.env.STRESS_PASSWORD ?? (await promptPassword());
  const accountIdRaw =
    cli.accountIdOverride ?? requiredOrPrompt('STRESS_ACCOUNT_ID', null);

  if (!password) {
    throw new Error('Password is required (use --password, STRESS_PASSWORD, or the interactive prompt).');
  }
  // F3: msgops-api's `getHeaderAccountId` does `Number(raw)` and falls back to
  // the first membership when NaN. Reject non-numeric IDs up front.
  if (!/^[0-9]+$/.test(accountIdRaw) || Number(accountIdRaw) <= 0) {
    throw new Error(
      `account-id must be a positive integer (got "${accountIdRaw}"). ` +
        'Query the accounts table in the compose Postgres to find the right id.',
    );
  }
  return { apiUrl, email, password, accountId: accountIdRaw };
}

function requiredOrPrompt(envKey: string, _flag: string | null): string {
  const v = process.env[envKey];
  if (!v) {
    throw new Error(
      `Missing required value: ${envKey} (set in .env.stress or pass the matching CLI flag).`,
    );
  }
  return v;
}

/**
 * Reads a password from stdin without echoing. If stdin is not a TTY (e.g.
 * running under CI), returns an empty string so the caller errors with a
 * clear "password required" message instead of hanging.
 */
async function promptPassword(): Promise<string> {
  if (!process.stdin.isTTY) return '';
  process.stdout.write('STRESS_PASSWORD (input hidden): ');
  return new Promise<string>((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buf = '';
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.removeListener('data', onData);
          stdin.setRawMode?.(wasRaw ?? false);
          stdin.pause();
          process.stdout.write('\n');
          return resolve(buf);
        }
        if (ch === '') {
          // Ctrl-C: bail clean.
          stdin.setRawMode?.(wasRaw ?? false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (ch === '' || ch === '\b') {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };
    stdin.on('data', onData);
  });
}

function stripPairedQuotes(raw: string): { value: string; wasQuoted: boolean } {
  const v = raw.trim();
  if (v.length >= 2) {
    const first = v[0]!;
    const last = v[v.length - 1]!;
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return { value: v.slice(1, -1), wasQuoted: true };
    }
  }
  return { value: raw, wasQuoted: false };
}

function findInlineCommentStart(s: string): number {
  // `#` only counts as a comment when preceded by whitespace (or at start),
  // so `pass#word` stays intact but `pass # comment` is trimmed.
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '#' && (i === 0 || /\s/.test(s[i - 1]!))) return i;
  }
  return -1;
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key} (see tools/contact-import-stress/.env.example)`);
  return v;
}

interface AttemptOutcome {
  failureClass: FailureClass;
  status: number | null;
  durationMs: number;
  metrics: MetricsSnapshot;
  responseBody: string;
}

async function runOnce(
  n: number,
  env: EnvConfig,
  token: string,
  cli: CliOptions,
): Promise<AttemptOutcome> {
  const batch = generatePayload(n, cli.seed);
  const collector = new ContainerMetricsCollector(cli.containerName);
  // F4: await start() so docker probe + first sample are in flight before the
  // request returns. Short requests (smoke) used to record mem=0.
  await collector.start();
  const httpResult = await importContacts({
    baseUrl: env.apiUrl,
    token,
    accountId: env.accountId,
    batch,
    timeoutMs: cli.timeoutMs,
  });
  const metrics = await collector.stop();
  // F5: trust the collector's continuous observation over a single post-request
  // inspect — `restart: unless-stopped` may have already brought the container
  // back to running by the time a one-shot inspect lands.
  const failureClass = classify({
    status: httpResult.status,
    aborted: httpResult.aborted,
    oomKilled: metrics.oomObserved,
  });
  return {
    failureClass,
    status: httpResult.status,
    durationMs: httpResult.durationMs,
    metrics,
    responseBody: httpResult.responseBody,
  };
}

function toRunRow(
  n: number,
  phase: RunPhase,
  seed: number,
  outcome: AttemptOutcome,
): RunRow {
  const throughput =
    outcome.failureClass === 'success' && outcome.durationMs > 0
      ? (n / outcome.durationMs) * 1000
      : null;
  const memMib =
    outcome.metrics.memPeakBytes === null
      ? null
      : outcome.metrics.memPeakBytes / 1_048_576;
  return {
    timestamp: new Date().toISOString(),
    seed,
    n,
    latencyMs: outcome.durationMs,
    throughputPerSec: throughput,
    memPeakMiB: memMib,
    cpuPeakPct: outcome.metrics.cpuPeakPct,
    httpStatus: outcome.status,
    failureClass: outcome.failureClass,
    phase,
  };
}

function logOutcome(n: number, phase: RunPhase, outcome: AttemptOutcome): void {
  const mem =
    outcome.metrics.memPeakBytes === null
      ? 'mem=n/a'
      : `mem=${(outcome.metrics.memPeakBytes / 1_048_576).toFixed(0)}MiB`;
  const cpu =
    outcome.metrics.cpuPeakPct === null
      ? 'cpu=n/a'
      : `cpu=${outcome.metrics.cpuPeakPct.toFixed(0)}%`;
  const status = outcome.status === null ? 'status=∅' : `status=${outcome.status}`;
  process.stdout.write(
    `[${phase} N=${n}] ${status} latency=${outcome.durationMs.toFixed(0)}ms ${mem} ${cpu} → ${outcome.failureClass}\n`,
  );
  if (!outcome.metrics.available) {
    process.stdout.write('  ⚠ metrics collector unavailable (docker unreachable)\n');
  }
}

async function main(): Promise<number> {
  let cli: CliOptions;
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`CLI error: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }

  let env: EnvConfig;
  try {
    env = await loadEnv(cli);
  } catch (err) {
    process.stderr.write(`Env error: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }

  const startedAt = new Date().toISOString();
  process.stdout.write(
    `▶ stress run started at ${startedAt}\n  api=${env.apiUrl}\n  container=${cli.containerName}\n  seed=${cli.seed} (pass --seed ${cli.seed} to reproduce)\n  sizes=[${cli.sizes.join(', ')}]\n`,
  );

  // AC6: auth must abort BEFORE the CSV is touched. Only create the writer
  // after login() succeeds.
  let token: string;
  try {
    token = await login({ baseUrl: env.apiUrl, email: env.email, password: env.password });
    process.stdout.write('  ✓ login ok\n');
  } catch (err) {
    if (err instanceof AuthError) {
      process.stderr.write(`Auth failed: HTTP ${err.status}\n`);
      if (err.body) process.stderr.write(`${err.body.slice(0, 500)}\n`);
    } else {
      process.stderr.write(`Auth failed: ${err instanceof Error ? err.message : String(err)}\n`);
    }
    return 1;
  }

  const csvPath = join(
    TOOL_DIR,
    'results',
    `run-${startedAt.replace(/[:.]/g, '-')}.csv`,
  );
  const csv = new CsvWriter(csvPath);
  csv.writeHeader();
  process.stdout.write(`  csv=${csvPath}\n`);

  const matrixPhase: RunPhase = cli.smoke ? 'smoke' : 'matrix';
  let lastSuccessN: number | null = null;
  let firstFailN: number | null = null;

  for (const n of cli.sizes) {
    const outcome = await runOnce(n, env, token, cli);
    csv.writeRow(toRunRow(n, matrixPhase, cli.seed, outcome));
    logOutcome(n, matrixPhase, outcome);

    if (outcome.failureClass === 'http-4xx') {
      process.stderr.write(
        'Configuration error — verifique permission `audience:contacts_import` e payload\n',
      );
      // Body kept short and on stderr only; do NOT echo to stdout to avoid
      // leaking validation echoes into logs/clipboard (F11).
      if (outcome.responseBody) {
        process.stderr.write(`  body: ${outcome.responseBody.slice(0, 200)}\n`);
      }
      await csv.close();
      return 2;
    }

    if (outcome.failureClass === 'success') {
      lastSuccessN = n;
      continue;
    }

    firstFailN = n;
    break;
  }

  let bisectResult: BisectResult | null = null;
  if (cli.bisectEnabled && firstFailN !== null && lastSuccessN !== null) {
    if (firstFailN - lastSuccessN > cli.bisectStep) {
      process.stdout.write(
        `▶ bisecting between lastSuccess=${lastSuccessN} firstFail=${firstFailN} (step=${cli.bisectStep})\n`,
      );
      try {
        // F7+F16: capture the result so the report uses the authoritative
        // narrowed bounds instead of reconstructing from CSV.
        bisectResult = await bisect({
          lastSuccess: lastSuccessN,
          firstFail: firstFailN,
          step: cli.bisectStep,
          maxIter: MAX_BISECT_ITER,
          attempt: async (mid) => {
            const outcome = await runOnce(mid, env, token, cli);
            csv.writeRow(toRunRow(mid, 'bisect', cli.seed, outcome));
            logOutcome(mid, 'bisect', outcome);
            return outcome.failureClass;
          },
        });
      } catch (err) {
        process.stderr.write(
          `Bisect aborted: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    } else {
      process.stdout.write(
        `▶ skipping bisect: gap (${firstFailN - lastSuccessN}) <= --bisect-step (${cli.bisectStep})\n`,
      );
    }
  } else if (cli.bisectEnabled && firstFailN !== null && lastSuccessN === null) {
    // F6: first matrix entry already failed — bisect has no successful baseline
    // to narrow against. Log it loudly instead of silently skipping.
    process.stdout.write(
      `▶ skipping bisect: no successful baseline (first N=${firstFailN} already failed). ` +
        'Re-run with smaller --sizes to establish a lower bound.\n',
    );
  }

  // F20: drain the CSV stream before exit so the last row isn't lost on crash.
  await csv.close();

  try {
    const summary = await generateReport({
      csvPath,
      reportPath: buildReportPath(startedAt),
      safetyMargin: cli.safetyMargin,
      seed: cli.seed,
      sizes: cli.sizes,
      containerName: cli.containerName,
      startedAt,
      smoke: cli.smoke,
      bisectResult,
    });
    process.stdout.write(`✓ report written: ${summary.writtenTo}\n`);
    if (summary.recommendedN !== null) {
      process.stdout.write(`  recommended N = ${summary.recommendedN}\n`);
    }
  } catch (err) {
    process.stderr.write(
      `Report writer failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`Fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  });
