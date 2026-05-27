/**
 * Shared date/time formatting helpers.
 *
 * Display rule (EVO-1409): grids and detail screens must show date + time
 * (`dd/mm/yyyy hh:MM`). The date-only format is reserved for filters, charts
 * and aggregated data.
 *
 * Both helpers are timezone- and locale-aware. When `timezone`/`locale` are
 * omitted they fall back to the browser settings, preserving prior behavior
 * for screens that have no account-timezone context.
 */

export interface DateFormatOptions {
  timezone?: string;
  locale?: string;
}

const DASH = '—';

function resolve(dateStr: string | null | undefined, options?: DateFormatOptions) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return {
    date,
    tz: options?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    loc: options?.locale || navigator.language,
  };
}

/**
 * Format a date with date + time (`dd/mm/yyyy hh:MM`, no seconds).
 * Use in grids and detail screens.
 */
export function formatDateTime(dateStr?: string | null, options?: DateFormatOptions): string {
  const r = resolve(dateStr, options);
  if (!r) return DASH;
  return r.date.toLocaleString(r.loc, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // Force a 24h clock so the AC format `hh:MM` holds even under locales
    // (e.g. en-US) that would otherwise render a 12h AM/PM time.
    hourCycle: 'h23',
    timeZone: r.tz,
  });
}

/**
 * Format a date without time (`dd/mm/yyyy`).
 * Use only in filters, charts and aggregated data.
 */
export function formatDate(dateStr?: string | null, options?: DateFormatOptions): string {
  const r = resolve(dateStr, options);
  if (!r) return DASH;
  return r.date.toLocaleDateString(r.loc, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: r.tz,
  });
}
