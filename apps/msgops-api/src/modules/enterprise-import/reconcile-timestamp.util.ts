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
    if (!br) return null;
    d = Number(br[1]);
    mo = Number(br[2]);
    y = Number(br[3]);
    if (br[4] !== undefined) {
      hasTime = true;
      hh = Number(br[4]);
      mi = Number(br[5]);
      ss = br[6] !== undefined ? Number(br[6]) : 0;
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

export function timeMatchLevel(contactCreatedAt: Date | null | undefined, ts: ParsedCsvTimestamp | null): TimeMatchLevel {
  if (!contactCreatedAt || !ts) return 0;
  const contactMs = contactCreatedAt.getTime();
  if (Number.isNaN(contactMs)) return 0;

  if (ts.hasTime) {
    // Compare at MINUTE precision: exports truncate seconds (and the DB keeps
    // milliseconds), so anything finer than the minute never agrees between
    // the two sides. Seconds in the CSV are a bonus we deliberately ignore —
    // once the minute matches, name similarity breaks any remaining tie.
    const MINUTE_MS = 60_000;
    const deltaMin = Math.floor(ts.epochMs / MINUTE_MS) - Math.floor(contactMs / MINUTE_MS);
    if (ts.hasOffset) {
      if (deltaMin === 0) return 2;
    } else {
      // The export timezone is unknown but constant. Accept a same-minute
      // match shifted by any fixed half-hour-aligned offset within ±14h.
      if (deltaMin % 30 === 0 && Math.abs(deltaMin) <= 14 * 60) return 2;
    }
  }

  const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  if (ts.dateISO === isoDate(contactMs) || ts.dateISO === isoDate(contactMs + EXPORT_TZ_OFFSET_MS)) return 1;
  return 0;
}
