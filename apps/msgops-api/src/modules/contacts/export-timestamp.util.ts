/**
 * Serializes a timestamp for the contacts CSV export.
 *
 * The streaming export writes rows straight from the driver, where a
 * `timestamptz` arrives as a JS `Date`. Handed to fast-csv untouched, it is
 * stringified with `Date.prototype.toString()` — a locale/host dependent string
 * ("Thu Jul 09 2026 03:48:16 GMT-0300 (Brasilia Standard Time)") that no
 * consumer can parse reliably, and which silently broke the created_at matching
 * on the enterprise-import reconciliation.
 *
 * ISO-8601 (UTC) is the contract: unambiguous, sortable, stable across hosts.
 * Values already stored as strings pass through unchanged — legacy rows may
 * carry a pre-formatted timestamp, and rewriting those is not this function's
 * business.
 */
export function toIsoTimestamp(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  return String(value);
}
