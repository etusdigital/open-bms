import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate, getWeekDays, isToday, flattenProducts, getUniqueHours } from '../products-utils';
import type { DayMap, DateProducts } from '../types';

describe('formatDate', () => {
  it('formats standard date as YYYY-MM-DD', () => {
    const date = new Date('2026-06-15T12:00:00Z');
    expect(formatDate(date)).toBe('2026-06-15');
  });

  it('pads single-digit month and day', () => {
    const date = new Date('2026-01-05T12:00:00Z');
    expect(formatDate(date)).toBe('2026-01-05');
  });
});

describe('getWeekDays', () => {
  it('returns 7 days starting from Monday for a Wednesday input', () => {
    // 2026-03-18 is a Wednesday
    const days = getWeekDays(new Date('2026-03-18T12:00:00'));
    expect(days).toHaveLength(7);
    expect(formatDate(days[0])).toBe('2026-03-16'); // Monday
    expect(formatDate(days[6])).toBe('2026-03-22'); // Sunday
  });

  it('returns Monday when input is already Monday', () => {
    // 2026-03-16 is a Monday
    const days = getWeekDays(new Date('2026-03-16T12:00:00'));
    expect(formatDate(days[0])).toBe('2026-03-16');
  });

  it('handles Sunday input (offset -6)', () => {
    // 2026-03-22 is a Sunday → should go back to Monday 2026-03-16
    const days = getWeekDays(new Date('2026-03-22T12:00:00'));
    expect(formatDate(days[0])).toBe('2026-03-16'); // Monday
    expect(formatDate(days[6])).toBe('2026-03-22'); // Sunday
  });

  it('handles Saturday input', () => {
    // 2026-03-21 is a Saturday → should go back to Monday 2026-03-16
    const days = getWeekDays(new Date('2026-03-21T12:00:00'));
    expect(formatDate(days[0])).toBe('2026-03-16');
  });

  it('handles month boundary (week spans two months)', () => {
    // 2026-03-30 is a Monday, week ends 2026-04-05 (Sunday in April)
    const days = getWeekDays(new Date('2026-04-01T12:00:00')); // Wednesday April 1
    expect(formatDate(days[0])).toBe('2026-03-30'); // Monday March 30
    expect(formatDate(days[6])).toBe('2026-04-05'); // Sunday April 5
  });

  it('first element always has getDay() === 1 (Monday)', () => {
    const inputs = [
      new Date('2026-03-16T12:00:00'), // Mon
      new Date('2026-03-17T12:00:00'), // Tue
      new Date('2026-03-18T12:00:00'), // Wed
      new Date('2026-03-19T12:00:00'), // Thu
      new Date('2026-03-20T12:00:00'), // Fri
      new Date('2026-03-21T12:00:00'), // Sat
      new Date('2026-03-22T12:00:00'), // Sun
    ];
    for (const input of inputs) {
      const days = getWeekDays(input);
      expect(days[0].getDay()).toBe(1); // Monday
    }
  });
});

describe('isToday', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00'));
    expect(isToday(new Date('2026-03-18T08:00:00'))).toBe(true);
  });

  it('returns false for yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00'));
    expect(isToday(new Date('2026-03-17T12:00:00'))).toBe(false);
  });

  it('returns false for same day/month different year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00'));
    expect(isToday(new Date('2025-03-18T12:00:00'))).toBe(false);
  });
});

describe('flattenProducts', () => {
  it('returns empty object for empty array', () => {
    expect(flattenProducts([])).toEqual({});
  });

  it('merges single DayMap', () => {
    const input: DayMap[] = [
      {
        '2026-03-16': {
          '10:00': {
            products: [{ title: 'A', link: '', messages: [], tags: {}, sendToAll: false }],
          },
        },
      },
    ];
    const result = flattenProducts(input);
    expect(Object.keys(result)).toEqual(['2026-03-16']);
    expect(result['2026-03-16']['10:00'].products).toHaveLength(1);
  });

  it('merges multiple DayMaps with different dates', () => {
    const input: DayMap[] = [
      { '2026-03-16': { '10:00': { products: [] } } },
      { '2026-03-17': { '11:00': { products: [] } } },
    ];
    const result = flattenProducts(input);
    expect(Object.keys(result).sort()).toEqual(['2026-03-16', '2026-03-17']);
  });
});

describe('getUniqueHours', () => {
  it('returns empty array for empty map', () => {
    expect(getUniqueHours({})).toEqual([]);
  });

  it('deduplicates hours across days', () => {
    const flatMap: Record<string, DateProducts> = {
      '2026-03-16': { '10:00': { products: [] }, '14:00': { products: [] } },
      '2026-03-17': { '10:00': { products: [] }, '16:00': { products: [] } },
    };
    expect(getUniqueHours(flatMap)).toEqual(['10:00', '14:00', '16:00']);
  });

  it('returns hours sorted lexicographically', () => {
    const flatMap: Record<string, DateProducts> = {
      '2026-03-16': {
        '16:00': { products: [] },
        '08:00': { products: [] },
        '12:00': { products: [] },
      },
    };
    expect(getUniqueHours(flatMap)).toEqual(['08:00', '12:00', '16:00']);
  });
});
