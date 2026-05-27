import { describe, it, expect } from 'vitest';
import { statisticsSearchSchema, parseCsvIds, serializeCsvIds } from '../statistics-search-schema';

describe('statisticsSearchSchema', () => {
  it('provides defaults for all fields when input is empty', () => {
    const result = statisticsSearchSchema.parse({});
    expect(result.channel).toBe('email');
    expect(result.startDate).toBe('');
    expect(result.endDate).toBe('');
    expect(result.displayMode).toBe('numeric');
    expect(result.showPerUser).toBe(false);
    expect(result.sortBy).toBe('date');
    expect(result.sortDesc).toBe(true);
    expect(result.campaigns).toBe('');
  });

  it('parses valid channel values', () => {
    expect(statisticsSearchSchema.parse({ channel: 'email' }).channel).toBe('email');
    expect(statisticsSearchSchema.parse({ channel: 'web-push' }).channel).toBe('web-push');
  });

  it('falls back to email for invalid channel', () => {
    expect(statisticsSearchSchema.parse({ channel: 'invalid' }).channel).toBe('email');
  });

  it('parses displayMode values', () => {
    expect(statisticsSearchSchema.parse({ displayMode: 'numeric' }).displayMode).toBe('numeric');
    expect(statisticsSearchSchema.parse({ displayMode: 'percentage' }).displayMode).toBe('percentage');
  });

  it('falls back to numeric for invalid displayMode', () => {
    expect(statisticsSearchSchema.parse({ displayMode: 'bad' }).displayMode).toBe('numeric');
  });

  it('parses boolean showPerUser', () => {
    expect(statisticsSearchSchema.parse({ showPerUser: true }).showPerUser).toBe(true);
    expect(statisticsSearchSchema.parse({ showPerUser: false }).showPerUser).toBe(false);
  });

  it('catches invalid values instead of throwing', () => {
    // .catch() should prevent parse errors for any field
    expect(() =>
      statisticsSearchSchema.parse({
        channel: 123,
        displayMode: null,
        showPerUser: 'not-bool',
        sortDesc: 'not-bool',
      }),
    ).not.toThrow();
  });
});

describe('parseCsvIds', () => {
  it('parses comma-separated IDs', () => {
    expect(parseCsvIds('1,2,3')).toEqual([1, 2, 3]);
  });

  it('returns empty array for empty string', () => {
    expect(parseCsvIds('')).toEqual([]);
  });

  it('filters out NaN values', () => {
    expect(parseCsvIds('1,abc,3')).toEqual([1, 3]);
  });

  it('handles single value', () => {
    expect(parseCsvIds('42')).toEqual([42]);
  });
});

describe('serializeCsvIds', () => {
  it('joins IDs with commas', () => {
    expect(serializeCsvIds([1, 2, 3])).toBe('1,2,3');
  });

  it('returns empty string for empty array', () => {
    expect(serializeCsvIds([])).toBe('');
  });
});
