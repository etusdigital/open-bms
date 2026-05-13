/**
 * Container metrics collector. Samples `docker stats` in a loop while a request
 * is in flight and tracks peak memory + CPU. Also exposes `isOOMKilled()` for
 * post-mortem on the container's `State.OOMKilled` flag.
 *
 * NOTE: `docker stats` has ~100-200ms internal granularity, so brief peaks for
 * small payloads may be missed. The README and the report writer both surface
 * this as a known ressalva.
 */

import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SAMPLE_INTERVAL_MS = 200;

export interface MetricsSnapshot {
  memPeakBytes: number | null;
  cpuPeakPct: number | null;
  samples: number;
  available: boolean; // false when docker is missing → AC11
  /**
   * True if at any point during the run we observed the container in an OOM
   * state (`State.OOMKilled=true`) or with `ExitCode=137` (SIGKILL — almost
   * always the OOM-killer). Sampling this throughout the request closes the
   * gap left by a single post-request inspect when `restart: unless-stopped`
   * brings the container back before we check (F5).
   */
  oomObserved: boolean;
}

interface DockerStatsLine {
  // Only the fields we care about. `docker stats --format '{{json .}}'` emits more.
  MemUsage?: string;
  CPUPerc?: string;
}

export class ContainerMetricsCollector {
  private readonly containerName: string;
  private memPeakBytes = 0;
  private cpuPeakPct = 0;
  private samples = 0;
  private available = true;
  private stopped = false;
  private oomObserved = false;
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(containerName: string) {
    this.containerName = containerName;
  }

  /**
   * Probe docker once and begin sampling. **Await this** before triggering the
   * work you want to measure so the first sample is in flight before the
   * request returns — fixes the race where short requests (smoke N=10) finish
   * before sampling even starts (F4).
   */
  async start(): Promise<void> {
    if (this.timer || this.stopped) return;
    try {
      await this.probeDocker();
    } catch {
      this.available = false;
      return;
    }
    // Kick off the first sample synchronously so `await start()` returns with
    // sampling already in progress.
    this.inFlight = this.sampleOnce().catch(() => undefined);
    const tick = (): void => {
      if (this.stopped || !this.available) return;
      this.inFlight = this.sampleOnce()
        .catch(() => undefined)
        .finally(() => {
          if (!this.stopped) this.timer = setTimeout(tick, SAMPLE_INTERVAL_MS);
        });
    };
    this.timer = setTimeout(tick, SAMPLE_INTERVAL_MS);
  }

  /** Stop sampling and return the peak observed. */
  async stop(): Promise<MetricsSnapshot> {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight) await this.inFlight;
    return {
      memPeakBytes: this.available ? this.memPeakBytes : null,
      cpuPeakPct: this.available ? this.cpuPeakPct : null,
      samples: this.samples,
      available: this.available,
      oomObserved: this.oomObserved,
    };
  }

  private async probeDocker(): Promise<void> {
    await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}'], {
      timeout: 2000,
    });
  }

  private async sampleOnce(): Promise<void> {
    // Sample stats AND container state in parallel each tick. The state probe
    // catches an OOM-then-restart cycle that a single post-request inspect
    // would miss (F5).
    const [stats, state] = await Promise.all([
      runDockerStatsOnce(this.containerName),
      inspectContainerState(this.containerName),
    ]);
    if (stats) {
      const memBytes = parseMemUsage(stats.MemUsage);
      const cpuPct = parseCpuPercent(stats.CPUPerc);
      if (memBytes !== null && memBytes > this.memPeakBytes) this.memPeakBytes = memBytes;
      if (cpuPct !== null && cpuPct > this.cpuPeakPct) this.cpuPeakPct = cpuPct;
      this.samples += 1;
    }
    if (state && (state.oomKilled || state.exitCode === 137)) {
      this.oomObserved = true;
    }
  }
}

/**
 * Spawns a single `docker stats --no-stream` invocation and resolves with the
 * parsed JSON of the first (only) line. Returns null on parse failures.
 */
function runDockerStatsOnce(containerName: string): Promise<DockerStatsLine | null> {
  return new Promise<DockerStatsLine | null>((resolve) => {
    let stdout = '';
    let stderr = '';
    let child: ChildProcess;
    try {
      child = spawn(
        'docker',
        ['stats', containerName, '--no-stream', '--format', '{{json .}}'],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch {
      return resolve(null);
    }
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code !== 0 || stderr.includes('No such container')) return resolve(null);
      const line = stdout.split('\n').find((l) => l.trim().startsWith('{'));
      if (!line) return resolve(null);
      try {
        resolve(JSON.parse(line) as DockerStatsLine);
      } catch {
        resolve(null);
      }
    });
  });
}

/**
 * Parses `docker stats` MemUsage like `"512.3MiB / 7.7GiB"` → bytes.
 * Returns null when the value is missing or malformed.
 */
export function parseMemUsage(raw: string | undefined): number | null {
  if (!raw) return null;
  const used = raw.split('/')[0]?.trim();
  if (!used) return null;
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*([KMGTPE]?i?B)$/i.exec(used);
  if (!match) return null;
  const value = Number.parseFloat(match[1]!);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1_000,
    kib: 1_024,
    mb: 1_000_000,
    mib: 1_048_576,
    gb: 1_000_000_000,
    gib: 1_073_741_824,
    tb: 1_000_000_000_000,
    tib: 1_099_511_627_776,
  };
  const m = multipliers[unit];
  if (m === undefined) return null;
  return Math.round(value * m);
}

/** Parses `docker stats` CPUPerc like `"42.31%"` → 42.31. */
export function parseCpuPercent(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace('%', '');
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reads `State.OOMKilled` from `docker inspect`. Kept for compatibility but
 * unreliable when the container restarts before this call lands (F5) — the
 * collector now also samples state during the request and exposes
 * `oomObserved` on the snapshot. Prefer the snapshot.
 */
export async function isOOMKilled(containerName: string): Promise<boolean> {
  const state = await inspectContainerState(containerName);
  return state?.oomKilled ?? false;
}

interface ContainerState {
  oomKilled: boolean;
  exitCode: number | null;
  status: string | null;
}

async function inspectContainerState(containerName: string): Promise<ContainerState | null> {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      [
        'inspect',
        containerName,
        '--format',
        '{{.State.OOMKilled}}|{{.State.ExitCode}}|{{.State.Status}}',
      ],
      { timeout: 3000 },
    );
    const [oom, exit, status] = stdout.trim().split('|');
    const exitCode = exit !== undefined && exit !== '' ? Number(exit) : null;
    return {
      oomKilled: oom === 'true',
      exitCode: exitCode !== null && Number.isFinite(exitCode) ? exitCode : null,
      status: status ?? null,
    };
  } catch {
    return null;
  }
}

export const __testing__ = { runDockerStatsOnce, inspectContainerState };
