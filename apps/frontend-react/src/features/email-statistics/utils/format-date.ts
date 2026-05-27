/**
 * Format daily aggregation dates from the API.
 *
 * The API returns dates like "2026-03-08T00:00:00.000Z" which represent
 * calendar dates (daily buckets), NOT precise moments in time.
 * We extract the YYYY-MM-DD portion and create a local Date object
 * to avoid timezone shifting (UTC midnight → previous day in negative-offset TZs).
 *
 * Formatting uses Intl.DateTimeFormat with the user's locale so date order
 * follows their language convention (DD/MM for pt-BR, MM/DD for en-US).
 */

const shortFormatters = new Map<string, Intl.DateTimeFormat>();
const fullFormatters = new Map<string, Intl.DateTimeFormat>();

/** Extract YYYY-MM-DD from an ISO string and return a local Date (no TZ shift) */
function toLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  // new Date(year, monthIndex, day) creates a LOCAL date — no UTC conversion
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getShortFormatter(locale: string): Intl.DateTimeFormat {
  let fmt = shortFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' });
    shortFormatters.set(locale, fmt);
  }
  return fmt;
}

function getFullFormatter(locale: string): Intl.DateTimeFormat {
  let fmt = fullFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    fullFormatters.set(locale, fmt);
  }
  return fmt;
}

/** Format as DD/MM or MM/DD based on locale (for chart x-axis) */
export function formatDateShort(dateStr: string, locale = 'pt-BR'): string {
  const date = toLocalDate(dateStr);
  if (!date) return '';
  return getShortFormatter(locale).format(date);
}

/** Format as DD/MM/YYYY or MM/DD/YYYY based on locale (for table cells) */
export function formatDateFull(dateStr: string, locale = 'pt-BR'): string {
  const date = toLocalDate(dateStr);
  if (!date) return '';
  return getFullFormatter(locale).format(date);
}
