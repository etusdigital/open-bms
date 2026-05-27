import { describe, it, expect } from 'vitest';
import { formatDateShort, formatDateFull } from '../utils/format-date';

describe('formatDateShort', () => {
  it('formats full ISO timestamp as DD/MM (extracts date portion)', () => {
    expect(formatDateShort('2026-03-08T00:00:00.000Z')).toBe('08/03');
  });

  it('formats ISO timestamp with time offset correctly', () => {
    // Even though this is T05:00 UTC, the date portion is still 2026-03-07
    expect(formatDateShort('2026-03-07T05:00:00.000Z')).toBe('07/03');
  });

  it('formats date-only string', () => {
    expect(formatDateShort('2026-03-08')).toBe('08/03');
  });

  it('does NOT shift dates due to timezone (daily dates are calendar labels)', () => {
    // Key test: midnight UTC should NOT become the previous day in negative-offset TZ
    expect(formatDateShort('2026-03-08T00:00:00.000Z')).toBe('08/03');
    expect(formatDateShort('2026-04-07T00:00:00.000Z')).toBe('07/04');
  });

  it('returns empty string for empty input', () => {
    expect(formatDateShort('')).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDateShort('not-a-date')).toBe('');
  });
});

describe('formatDateFull', () => {
  it('formats full ISO timestamp as DD/MM/YYYY', () => {
    expect(formatDateFull('2026-03-08T00:00:00.000Z')).toBe('08/03/2026');
  });

  it('does NOT shift dates due to timezone', () => {
    expect(formatDateFull('2026-03-08T00:00:00.000Z')).toBe('08/03/2026');
    expect(formatDateFull('2026-04-07T00:00:00.000Z')).toBe('07/04/2026');
  });

  it('formats date-only string', () => {
    expect(formatDateFull('2026-04-07')).toBe('07/04/2026');
  });

  it('returns empty for empty input', () => {
    expect(formatDateFull('')).toBe('');
  });
});
