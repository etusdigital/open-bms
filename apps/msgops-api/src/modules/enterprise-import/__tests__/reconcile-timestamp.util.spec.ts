import { inferCsvOffsetMinutes, parseCsvTimestamp, timeMatchLevel } from '../reconcile-timestamp.util';

/**
 * created_at is the strongest matching signal of the reconciliation, so the
 * two things that can quietly destroy it are covered here: a format the parser
 * refuses (the timestamp becomes null and matching falls back to names), and a
 * timezone offset taken as free per candidate (unrelated rows claim the exact
 * agreement tier).
 */
describe('parseCsvTimestamp', () => {
  it('parses ISO with and without an explicit offset', () => {
    expect(parseCsvTimestamp('2026-07-09T07:48:16Z')).toMatchObject({ hasTime: true, hasOffset: true, dateISO: '2026-07-09' });
    expect(parseCsvTimestamp('2026-07-09 04:48:16')).toMatchObject({ hasTime: true, hasOffset: false });
    expect(parseCsvTimestamp('2026-07-09')).toMatchObject({ hasTime: false, dateISO: '2026-07-09' });
  });

  it('parses the Brazilian export format', () => {
    expect(parseCsvTimestamp('09/07/2026 04:48')).toMatchObject({ hasTime: true, hasOffset: false, dateISO: '2026-07-09' });
  });

  it('parses the locale string the streaming export used to emit', () => {
    // What fast-csv wrote when a raw Date reached it. Rejecting this shape made
    // created_at null on every row of a real export.
    const parsed = parseCsvTimestamp('Thu Jul 09 2026 03:48:16 GMT-0400 (Eastern Daylight Time)');

    expect(parsed).toMatchObject({ hasTime: true, hasOffset: true, dateISO: '2026-07-09' });
    expect(parsed!.epochMs).toBe(Date.parse('2026-07-09T07:48:16Z'));
  });

  it('returns null for anything it cannot read', () => {
    expect(parseCsvTimestamp('')).toBeNull();
    expect(parseCsvTimestamp('not a date')).toBeNull();
    expect(parseCsvTimestamp('2026-13-45')).toBeNull();
  });
});

describe('inferCsvOffsetMinutes', () => {
  const ts = (raw: string) => parseCsvTimestamp(raw)!;
  const at = (raw: string) => Date.parse(raw);

  it('infers a single offset from the mode of trusted pairs', () => {
    const pairs = [
      { contactMs: at('2023-04-01T13:00:00Z'), ts: ts('2023-04-01 10:00:00') },
      { contactMs: at('2023-04-02T18:30:00Z'), ts: ts('2023-04-02 15:30:00') },
      { contactMs: at('2023-04-03T21:45:00Z'), ts: ts('2023-04-03 18:45:00') },
      // Noise: a pair that disagrees must not move the result.
      { contactMs: at('2023-04-04T10:00:00Z'), ts: ts('2023-04-04 02:00:00') },
    ];

    expect(inferCsvOffsetMinutes(pairs)).toBe(-180);
  });

  it('refuses to guess from too few pairs', () => {
    const pairs = [
      { contactMs: at('2023-04-01T13:00:00Z'), ts: ts('2023-04-01 10:00:00') },
      { contactMs: at('2023-04-02T18:30:00Z'), ts: ts('2023-04-02 15:30:00') },
    ];

    expect(inferCsvOffsetMinutes(pairs)).toBeNull();
  });

  it('refuses to guess when no offset dominates', () => {
    const pairs = [
      { contactMs: at('2023-04-01T13:00:00Z'), ts: ts('2023-04-01 10:00:00') },
      { contactMs: at('2023-04-02T18:30:00Z'), ts: ts('2023-04-02 13:30:00') },
      { contactMs: at('2023-04-03T21:45:00Z'), ts: ts('2023-04-03 20:45:00') },
      { contactMs: at('2023-04-04T09:00:00Z'), ts: ts('2023-04-04 02:00:00') },
    ];

    expect(inferCsvOffsetMinutes(pairs)).toBeNull();
  });

  it('ignores timestamps that already carry their own offset', () => {
    const pairs = [
      { contactMs: at('2023-04-01T13:00:00Z'), ts: ts('2023-04-01T13:00:00Z') },
      { contactMs: at('2023-04-02T18:30:00Z'), ts: ts('2023-04-02T18:30:00Z') },
      { contactMs: at('2023-04-03T21:45:00Z'), ts: ts('2023-04-03T21:45:00Z') },
    ];

    expect(inferCsvOffsetMinutes(pairs)).toBeNull();
  });
});

describe('timeMatchLevel', () => {
  const contact = new Date('2023-04-10T14:22:31.874Z');
  const ts = (raw: string) => parseCsvTimestamp(raw);

  it('grants the exact tier under the inferred offset only', () => {
    expect(timeMatchLevel(contact, ts('2023-04-10 11:22'), -180)).toBe(2);
    // Same shift the old rule accepted as "some plausible offset".
    expect(timeMatchLevel(contact, ts('2023-04-10 09:22'), -180)).toBe(1);
  });

  it('never grants the exact tier to an offset-less timestamp when no offset was inferred', () => {
    expect(timeMatchLevel(contact, ts('2023-04-10 11:22'), null)).toBe(1);
  });

  it('ignores the inferred offset when the timestamp carries its own', () => {
    expect(timeMatchLevel(contact, ts('2023-04-10T14:22:00Z'), -180)).toBe(2);
    expect(timeMatchLevel(contact, ts('2023-04-10T11:22:00Z'), -180)).toBe(1);
  });

  it('falls back to day agreement, and to nothing when the dates differ', () => {
    expect(timeMatchLevel(contact, ts('2023-04-10'), null)).toBe(1);
    expect(timeMatchLevel(contact, ts('2024-08-01'), null)).toBe(0);
    expect(timeMatchLevel(null, ts('2023-04-10'), null)).toBe(0);
    expect(timeMatchLevel(contact, null, null)).toBe(0);
  });
});
