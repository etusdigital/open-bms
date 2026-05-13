/**
 * Append-only CSV writer for stress runs. Columns are deliberately stable —
 * downstream report-writer and ad-hoc analysis both depend on them.
 */

import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { dirname } from 'node:path';

import type { FailureClass } from './failure-classifier';

export type RunPhase = 'matrix' | 'bisect' | 'smoke';

export interface RunRow {
  timestamp: string;
  seed: number;
  n: number;
  latencyMs: number;
  throughputPerSec: number | null;
  memPeakMiB: number | null;
  cpuPeakPct: number | null;
  httpStatus: number | null;
  failureClass: FailureClass;
  phase: RunPhase;
}

export const CSV_COLUMNS = [
  'timestamp',
  'seed',
  'n',
  'latency_ms',
  'throughput_per_sec',
  'mem_peak_mib',
  'cpu_peak_pct',
  'http_status',
  'failure_class',
  'phase',
] as const;

export class CsvWriter {
  private readonly stream: WriteStream;
  private headerWritten = false;
  readonly path: string;

  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.stream = createWriteStream(path, { flags: 'a', encoding: 'utf8' });
    this.stream.on('error', (err) => {
      // Surface to stderr so a broken results dir doesn't fail silently.
      process.stderr.write(`csv-writer error: ${err.message}\n`);
    });
  }

  writeHeader(): void {
    if (this.headerWritten) return;
    this.stream.write(`${CSV_COLUMNS.join(',')}\n`);
    this.headerWritten = true;
  }

  writeRow(row: RunRow): void {
    if (!this.headerWritten) this.writeHeader();
    const cells = [
      row.timestamp,
      String(row.seed),
      String(row.n),
      row.latencyMs.toFixed(2),
      row.throughputPerSec === null ? '' : row.throughputPerSec.toFixed(2),
      row.memPeakMiB === null ? '' : row.memPeakMiB.toFixed(2),
      row.cpuPeakPct === null ? '' : row.cpuPeakPct.toFixed(2),
      row.httpStatus === null ? '' : String(row.httpStatus),
      row.failureClass,
      row.phase,
    ];
    this.stream.write(`${cells.map(escapeCell).join(',')}\n`);
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.stream.end(() => resolve());
    });
  }
}

/**
 * RFC 4180-ish cell escape: today's columns are all numeric/enum/ISO and never
 * contain `,` `"` or newlines, so this is a no-op for the current row shape.
 * Kept as a guardrail so a future column with free-form content (e.g.
 * `response_body`) doesn't silently corrupt the CSV (F14).
 */
function escapeCell(cell: string): string {
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}
