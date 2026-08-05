import type { ParsedCsvTimestamp, TimeMatchLevel } from './email-reconcile.types';

// created_at is a match signal because the import worker preserves the
// Enterprise timestamp verbatim (base.importer.ts keeps source createdAt on
// insert and never overwrites it on re-import), and the BMS CSV export carries
// that same source column. When both sides agree, the pair is effectively a
// natural key on top of the email mask.

// ISO / SQL-ish: YYYY-MM-DD[ T]HH:mm[:ss[.SSS]][Z|±HH[:]MM]
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i;
// Brazilian export format: DD/MM/YYYY[ HH:mm[:ss]]
const BR_RE = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
// JS `Date.prototype.toString()`: `Thu Jul 09 2026 03:48:16 GMT-0300 (...)`.
// This is what the contacts export actually emits whenever a raw `Date` from
// the driver reaches fast-csv without an explicit serializer — the exporter now
// writes ISO, but CSVs downloaded before that fix are still in operator hands.
const LOCALE_RE = /^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s*(?:GMT\s*([+-]\d{4}))?/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseCsvTimestamp(raw: string): ParsedCsvTimestamp | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  let y: number, mo: number, d: number;
  let hh = 0;
  let mi = 0;
  let ss = 0;
  let offset: string | undefined;
  let hasTime = false;

  const iso = s.match(ISO_RE);
  if (iso) {
    y = Number(iso[1]);
    mo = Number(iso[2]);
    d = Number(iso[3]);
    if (iso[4] !== undefined) {
      hasTime = true;
      hh = Number(iso[4]);
      mi = Number(iso[5]);
      ss = iso[6] !== undefined ? Number(iso[6]) : 0;
      offset = iso[7];
    }
  } else {
    const br = s.match(BR_RE);
    if (br) {
      d = Number(br[1]);
      mo = Number(br[2]);
      y = Number(br[3]);
      if (br[4] !== undefined) {
        hasTime = true;
        hh = Number(br[4]);
        mi = Number(br[5]);
        ss = br[6] !== undefined ? Number(br[6]) : 0;
      }
    } else {
      const loc = s.match(LOCALE_RE);
      if (!loc) return null;
      const monthIndex = MONTHS.indexOf(loc[1].toLowerCase());
      if (monthIndex < 0) return null;
      mo = monthIndex + 1;
      d = Number(loc[2]);
      y = Number(loc[3]);
      hasTime = true;
      hh = Number(loc[4]);
      mi = Number(loc[5]);
      ss = Number(loc[6]);
      // `GMT-0300` is an absolute offset — normalize it to the ISO shape so the
      // epoch math below is shared with the other formats.
      if (loc[7]) offset = `${loc[7].slice(0, 3)}:${loc[7].slice(3)}`;
    }
  }

  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mi > 59 || ss > 59) return null;

  let epochMs = Date.UTC(y, mo - 1, d, hh, mi, ss);
  let hasOffset = false;
  if (offset) {
    hasOffset = true;
    if (offset.toUpperCase() !== 'Z') {
      const om = offset.match(/^([+-])(\d{2}):?(\d{2})$/);
      if (om) {
        const sign = om[1] === '-' ? -1 : 1;
        epochMs -= sign * (Number(om[2]) * 60 + Number(om[3])) * 60_000;
      }
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return { epochMs, hasTime, hasOffset, dateISO: `${y}-${pad(mo)}-${pad(d)}` };
}

// Export timezone for BMS data — used only for the day-level comparison, where
// the calendar date written in the CSV may differ from the UTC date stored in
// the DB around midnight.
const EXPORT_TZ_OFFSET_MS = -3 * 3600_000; // America/Sao_Paulo (no DST since 2019)

const MINUTE_MS = 60_000;
// Real timezones are quarter-hour aligned and live within ±14h of UTC.
const OFFSET_STEP_MIN = 15;
const MAX_OFFSET_MIN = 14 * 60;
// Inference guards: too few pairs, or no clearly dominant delta, and we refuse
// to guess — the CSV then only reaches day-level agreement, which is the safe
// failure (an operator decision) instead of a confident wrong match.
const MIN_OFFSET_SAMPLES = 3;
const OFFSET_DOMINANCE = 0.6;

/** Minute-precision delta between a CSV timestamp and a contact's created_at. */
function deltaMinutes(contactMs: number, ts: ParsedCsvTimestamp): number {
  return Math.floor(ts.epochMs / MINUTE_MS) - Math.floor(contactMs / MINUTE_MS);
}

/**
 * Infers THE timezone offset of a CSV whose timestamps carry no explicit one.
 *
 * The export writes local time in a single, constant timezone. Accepting any
 * plausible offset per candidate (the previous behaviour) meant unrelated rows
 * could each claim the strongest agreement tier — 57 different offsets are
 * "plausible", so exact-instant agreement stopped meaning anything.
 *
 * Instead the caller feeds pairs it already trusts (contacts whose mask
 * collides with exactly one CSV row on both sides), and the offset is the mode
 * of their deltas: true pairs all share the same shift, noise scatters. Returns
 * null when the sample is too small or too spread out to commit to one value.
 */
export function inferCsvOffsetMinutes(pairs: Array<{ contactMs: number; ts: ParsedCsvTimestamp | null }>): number | null {
  const tally = new Map<number, number>();
  let considered = 0;

  for (const { contactMs, ts } of pairs) {
    if (!ts || !ts.hasTime || ts.hasOffset || !Number.isFinite(contactMs)) continue;
    const delta = deltaMinutes(contactMs, ts);
    if (Math.abs(delta) > MAX_OFFSET_MIN || delta % OFFSET_STEP_MIN !== 0) continue;
    considered++;
    tally.set(delta, (tally.get(delta) ?? 0) + 1);
  }

  if (considered < MIN_OFFSET_SAMPLES) return null;

  let bestDelta = 0;
  let bestCount = 0;
  for (const [delta, count] of tally) {
    // Ties break towards the smaller shift — a real export is far more likely
    // to sit near UTC than 13 hours away.
    if (count > bestCount || (count === bestCount && Math.abs(delta) < Math.abs(bestDelta))) {
      bestDelta = delta;
      bestCount = count;
    }
  }

  return bestCount >= considered * OFFSET_DOMINANCE ? bestDelta : null;
}

/**
 * Agreement between a contact's created_at and a CSV timestamp.
 *
 * `offsetMinutes` is the single offset inferred for the whole CSV
 * (inferCsvOffsetMinutes). Timestamps that carry their own offset ignore it;
 * timestamps without one only reach the exact tier when they match under THAT
 * offset — never under "some offset that happens to fit this candidate".
 */
export function timeMatchLevel(contactCreatedAt: Date | null | undefined, ts: ParsedCsvTimestamp | null, offsetMinutes: number | null = null): TimeMatchLevel {
  if (!contactCreatedAt || !ts) return 0;
  const contactMs = contactCreatedAt.getTime();
  if (Number.isNaN(contactMs)) return 0;

  if (ts.hasTime) {
    // Compare at MINUTE precision: exports truncate seconds (and the DB keeps
    // milliseconds), so anything finer than the minute never agrees between
    // the two sides. Seconds in the CSV are a bonus we deliberately ignore —
    // once the minute matches, name similarity breaks any remaining tie.
    const delta = deltaMinutes(contactMs, ts);
    if (ts.hasOffset) {
      if (delta === 0) return 2;
    } else if (offsetMinutes !== null && delta === offsetMinutes) {
      return 2;
    }
  }

  // Day-level fallback: the calendar date written in the CSV is local to the
  // export, so around midnight it legitimately differs from the UTC date in the
  // DB. Shift by the inferred offset when we have one, otherwise by the default
  // export timezone.
  const shiftMs = offsetMinutes !== null ? offsetMinutes * MINUTE_MS : EXPORT_TZ_OFFSET_MS;
  const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  if (ts.dateISO === isoDate(contactMs) || ts.dateISO === isoDate(contactMs + shiftMs)) return 1;
  return 0;
}
