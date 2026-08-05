import { toIsoTimestamp } from '../export-timestamp.util';

/**
 * Regression guard for the contacts CSV export contract.
 *
 * The streaming export writes rows straight from the driver, so `created_at`
 * arrives as a JS Date. Handed to fast-csv untouched it was stringified as
 * `Date.prototype.toString()` — a locale/host dependent string that silently
 * broke the created_at matching of the enterprise-import reconciliation.
 */
describe('toIsoTimestamp', () => {
  it('serializes a Date as ISO-8601 UTC, never as a locale string', () => {
    const value = toIsoTimestamp(new Date('2026-07-09T07:48:16.039Z'));

    expect(value).toBe('2026-07-09T07:48:16.039Z');
    expect(value).not.toMatch(/GMT/);
  });

  it('is stable regardless of the host timezone', () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = 'America/Sao_Paulo';
      const sp = toIsoTimestamp(new Date(1783000000000));
      process.env.TZ = 'UTC';
      const utc = toIsoTimestamp(new Date(1783000000000));
      expect(sp).toBe(utc);
    } finally {
      process.env.TZ = previous;
    }
  });

  it('passes an already formatted string through untouched', () => {
    expect(toIsoTimestamp('2026-07-09 04:48:16')).toBe('2026-07-09 04:48:16');
  });

  it('renders empty for missing or invalid values instead of "Invalid Date"', () => {
    expect(toIsoTimestamp(null)).toBe('');
    expect(toIsoTimestamp(undefined)).toBe('');
    expect(toIsoTimestamp('')).toBe('');
    expect(toIsoTimestamp(new Date('nope'))).toBe('');
  });
});
