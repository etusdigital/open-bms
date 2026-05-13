/**
 * Markdown report generator. Reads the run's CSV and produces the artifact in
 * `_evo-output/.../stress-test-report.md`. If the file exists, append an ISO
 * timestamp to the filename so successive runs don't clobber prior results.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, basename } from 'node:path';

import { CSV_COLUMNS } from './csv-writer';
import type { FailureClass } from './failure-classifier';
import { isLimitFailure } from './failure-classifier';
import type { BisectResult } from './bisect';

export interface ReportOptions {
  csvPath: string;
  reportPath: string;
  safetyMargin: number;
  seed: number;
  sizes: number[];
  containerName: string;
  startedAt: string;
  /** Distinguishes the heading for `--smoke` runs (F17). */
  smoke?: boolean;
  /** Authoritative narrowing from the bisect helper (F7+F16). */
  bisectResult?: BisectResult | null;
}

export interface ReportSummary {
  recommendedN: number | null;
  firstFailN: number | null;
  lastSuccessN: number | null;
  bisectedLimit: number | null;
  writtenTo: string;
}

interface ParsedRow {
  timestamp: string;
  seed: number;
  n: number;
  latencyMs: number;
  throughputPerSec: number | null;
  memPeakMiB: number | null;
  cpuPeakPct: number | null;
  httpStatus: number | null;
  failureClass: FailureClass;
  phase: 'matrix' | 'bisect' | 'smoke';
}

const BAR_GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

export async function generate(opts: ReportOptions): Promise<ReportSummary> {
  const rows = parseCsv(opts.csvPath);
  const matrixRows = rows.filter((r) => r.phase === 'matrix' || r.phase === 'smoke');
  const bisectRows = rows.filter((r) => r.phase === 'bisect');

  const firstFail = matrixRows.find((r) => isLimitFailure(r.failureClass));
  const lastSuccessBeforeFail = firstFail
    ? [...matrixRows]
        .filter((r) => r.failureClass === 'success' && r.n < firstFail.n)
        .pop() ?? null
    : null;

  // Prefer the authoritative narrowed lower-bound from bisect() when provided
  // (F7+F16); fall back to highest successful bisect row.
  const bisectedLimit =
    opts.bisectResult?.lastSuccess ??
    (bisectRows.length
      ? [...bisectRows]
          .filter((r) => r.failureClass === 'success')
          .sort((a, b) => b.n - a.n)[0]?.n ?? null
      : null);

  const recommendedN = firstFail
    ? Math.floor(firstFail.n * opts.safetyMargin)
    : null;

  const md = renderMarkdown({
    opts,
    rows,
    matrixRows,
    bisectRows,
    firstFailN: firstFail?.n ?? null,
    lastSuccessN: lastSuccessBeforeFail?.n ?? null,
    bisectedLimit,
    recommendedN,
  });

  const finalPath = resolveReportPath(opts.reportPath);
  mkdirSync(dirname(finalPath), { recursive: true });
  writeFileSync(finalPath, md, 'utf8');

  return {
    recommendedN,
    firstFailN: firstFail?.n ?? null,
    lastSuccessN: lastSuccessBeforeFail?.n ?? null,
    bisectedLimit,
    writtenTo: finalPath,
  };
}

function resolveReportPath(reportPath: string): string {
  if (!existsSync(reportPath)) return reportPath;
  const ext = extname(reportPath);
  const stem = basename(reportPath, ext);
  const dir = dirname(reportPath);
  // F13: ms-resolution timestamp + short random suffix to dodge same-ms
  // collisions when two runs land in the same millisecond.
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = Math.random().toString(36).slice(2, 6);
  return join(dir, `${stem}-${ts}-${rand}${ext}`);
}

interface RenderInput {
  opts: ReportOptions;
  rows: ParsedRow[];
  matrixRows: ParsedRow[];
  bisectRows: ParsedRow[];
  firstFailN: number | null;
  lastSuccessN: number | null;
  bisectedLimit: number | null;
  recommendedN: number | null;
}

function renderMarkdown(input: RenderInput): string {
  const { opts, matrixRows, bisectRows, firstFailN, lastSuccessN, bisectedLimit, recommendedN } = input;
  const lines: string[] = [];

  lines.push('# Stress Test Report — Contact Import (`POST /contacts/import`)');
  lines.push('');
  lines.push('## Metadata');
  lines.push('');
  lines.push(`- **Started at:** ${opts.startedAt}`);
  lines.push(`- **Seed:** \`${opts.seed}\``);
  lines.push(`- **Sizes (matrix):** \`[${opts.sizes.join(', ')}]\``);
  lines.push(`- **Container observed:** \`${opts.containerName}\``);
  lines.push(`- **Safety margin:** \`${opts.safetyMargin}\``);
  lines.push(`- **Source CSV:** \`${opts.csvPath}\``);
  lines.push('');

  lines.push(`## Resultados — ${opts.smoke ? 'Smoke' : 'Matriz'}`);
  lines.push('');
  lines.push(renderTable(matrixRows));
  lines.push('');

  if (bisectRows.length > 0) {
    lines.push('## Resultados — Bisseção');
    lines.push('');
    lines.push(renderTable(bisectRows));
    lines.push('');
  }

  lines.push('## Curva ASCII');
  lines.push('');
  lines.push('### Latência (ms) por N');
  lines.push('```');
  lines.push(renderAsciiChart(matrixRows, (r) => r.latencyMs));
  lines.push('```');
  lines.push('');
  lines.push('### Memória pico (MiB) por N');
  lines.push('```');
  lines.push(renderAsciiChart(matrixRows, (r) => r.memPeakMiB));
  lines.push('```');
  lines.push('');

  lines.push('## Limite Recomendado');
  lines.push('');
  if (recommendedN === null) {
    lines.push(
      'Nenhuma falha foi observada na matriz executada — não dá para inferir o N-limite ' +
        'a partir desta corrida. Rode novamente com Ns maiores ou aceite que o teto está ' +
        'acima do maior N testado.',
    );
  } else {
    lines.push(`- **Recommended N:** \`${recommendedN}\``);
    lines.push(`- **Heurística:** \`floor(firstFailN * safetyMargin) = floor(${firstFailN} * ${opts.safetyMargin})\`.`);
    lines.push(`- **Último N bem-sucedido (matriz):** \`${lastSuccessN ?? 'n/a'}\`.`);
    if (bisectedLimit !== null) {
      lines.push(`- **Maior N bem-sucedido após bisseção:** \`${bisectedLimit}\`.`);
    }
  }
  lines.push('');

  lines.push('## Ressalvas');
  lines.push('');
  lines.push(
    '- **Granularidade do `docker stats` (~100–200ms):** picos de memória/CPU em ' +
      'requests rápidos (N pequeno, < ~200ms) podem ser **subestimados**.',
  );
  lines.push(
    '- **Ambiente local ≠ produção:** RAM/CPU/IO do desktop diferem do staging/prod. ' +
      'O N-limite extraído aqui é piso de referência — produção pode tolerar mais (ou ' +
      'menos) dependendo do hardware e da concorrência multi-account.',
  );
  lines.push(
    '- **Carga sequencial single-account:** uma única chamada por vez, uma só conta. ' +
      'Em prod múltiplas contas podem importar concorrentemente — o limite real por ' +
      'instância pode ser **menor** do que o medido.',
  );
  lines.push(
    '- **Postgres co-locado no host:** com saves seriais, o gargalo provável é o RTT ' +
      'por insert. IO local tende a ser mais rápido que um Postgres gerenciado — outro ' +
      'fator de otimismo na métrica.',
  );
  lines.push(
    '- **Gateway/proxy:** este teste bate direto no port exposto do compose. Se prod ' +
      'tiver nginx/cloudflare na frente, timeouts e respostas mudam — não extrapole.',
  );
  lines.push('');

  return lines.join('\n');
}

function renderTable(rows: ParsedRow[]): string {
  if (rows.length === 0) return '_(sem linhas)_';
  const header =
    '| N | status | latency_ms | throughput/s | mem_peak_mib | cpu_peak_pct | failure_class | phase |';
  const sep =
    '| ---: | ---: | ---: | ---: | ---: | ---: | :--- | :--- |';
  const body = rows.map((r) =>
    `| ${r.n} | ${r.httpStatus ?? '—'} | ${r.latencyMs.toFixed(1)} | ${
      r.throughputPerSec === null ? '—' : r.throughputPerSec.toFixed(1)
    } | ${r.memPeakMiB === null ? '—' : r.memPeakMiB.toFixed(1)} | ${
      r.cpuPeakPct === null ? '—' : r.cpuPeakPct.toFixed(1)
    } | ${r.failureClass} | ${r.phase} |`,
  );
  return [header, sep, ...body].join('\n');
}

function renderAsciiChart(rows: ParsedRow[], pick: (r: ParsedRow) => number | null): string {
  if (rows.length === 0) return '(sem dados)';
  const values = rows.map(pick);
  const numeric = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (numeric.length === 0) return '(sem valores numéricos)';
  const max = Math.max(...numeric);
  if (max <= 0) return '(todos os valores são zero)';

  const labelWidth = Math.max(...rows.map((r) => String(r.n).length));
  const valueWidth = Math.max(...rows.map((r) => formatValue(pick(r)).length));

  return rows
    .map((r) => {
      const v = pick(r);
      const glyph =
        v === null || !Number.isFinite(v)
          ? '·'
          : BAR_GLYPHS[
              Math.min(
                BAR_GLYPHS.length - 1,
                Math.max(0, Math.floor((v / max) * (BAR_GLYPHS.length - 1))),
              )
            ];
      return `N=${String(r.n).padStart(labelWidth)} ${formatValue(v).padStart(valueWidth)} ${glyph}`;
    })
    .join('\n');
}

function formatValue(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  if (v >= 100) return v.toFixed(0);
  return v.toFixed(1);
}

function parseCsv(path: string): ParsedRow[] {
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0]!.split(',');
  // Sanity: bail if columns drift, so the report doesn't lie silently.
  for (let i = 0; i < CSV_COLUMNS.length; i++) {
    if (header[i] !== CSV_COLUMNS[i]) {
      throw new Error(
        `report-writer: CSV header mismatch at column ${i}: expected "${CSV_COLUMNS[i]}", got "${header[i]}"`,
      );
    }
  }
  const out: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(',');
    out.push({
      timestamp: cells[0]!,
      seed: Number(cells[1]),
      n: Number(cells[2]),
      latencyMs: Number(cells[3]),
      throughputPerSec: cells[4] === '' ? null : Number(cells[4]),
      memPeakMiB: cells[5] === '' ? null : Number(cells[5]),
      cpuPeakPct: cells[6] === '' ? null : Number(cells[6]),
      httpStatus: cells[7] === '' ? null : Number(cells[7]),
      failureClass: cells[8] as FailureClass,
      phase: cells[9] as 'matrix' | 'bisect' | 'smoke',
    });
  }
  return out;
}
