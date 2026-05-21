import { describe, it, expect } from 'vitest';
import { formatDateTime, formatDate } from '../datetime';

describe('formatDateTime', () => {
  it('returns dash for undefined', () => {
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('returns dash for null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('returns dash for invalid date', () => {
    expect(formatDateTime('not-a-date')).toBe('—');
  });

  it('includes a time component (dd/mm/yyyy hh:MM)', () => {
    const result = formatDateTime('2026-03-15T14:30:00Z', {
      timezone: 'UTC',
      locale: 'pt-BR',
    });
    expect(result).toContain('15/03/2026');
    expect(result).toContain('14:30');
  });

  it('applies the requested timezone', () => {
    // 01:00 UTC is 22:00 of the previous day in America/Sao_Paulo (GMT-3)
    const result = formatDateTime('2026-05-20T01:00:00Z', {
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
    });
    expect(result).toContain('19/05/2026');
    expect(result).toContain('22:00');
  });

  it('does not append a timezone label', () => {
    const result = formatDateTime('2026-03-15T14:30:00Z', {
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
    });
    expect(result).not.toMatch(/GMT|UTC/);
  });
});

describe('formatDate', () => {
  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('returns dash for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('formats date-only without a time component', () => {
    const result = formatDate('2026-03-15T14:30:00Z', {
      timezone: 'UTC',
      locale: 'pt-BR',
    });
    expect(result).toContain('15/03/2026');
    expect(result).not.toMatch(/\d{1,2}:\d{2}/);
  });
});
