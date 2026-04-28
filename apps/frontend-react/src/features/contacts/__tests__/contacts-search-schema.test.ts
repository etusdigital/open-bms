import { describe, it, expect } from 'vitest';
import { parseCsvIds, serializeCsvIds, contactsSearchSchema } from '../contacts-search-schema';

describe('parseCsvIds', () => {
  it('parses comma-separated string to number array', () => {
    expect(parseCsvIds('1,2,3')).toEqual([1, 2, 3]);
  });

  it('returns empty array for empty string', () => {
    expect(parseCsvIds('')).toEqual([]);
  });

  it('filters out NaN values', () => {
    expect(parseCsvIds('1,abc,3')).toEqual([1, 3]);
  });

  it('preserves zero values', () => {
    expect(parseCsvIds('0,1,2')).toEqual([0, 1, 2]);
  });

  it('handles single zero', () => {
    expect(parseCsvIds('0')).toEqual([0]);
  });

  it('handles single value', () => {
    expect(parseCsvIds('42')).toEqual([42]);
  });

  it('handles trailing comma', () => {
    expect(parseCsvIds('1,2,')).toEqual([1, 2]);
  });
});

describe('serializeCsvIds', () => {
  it('serializes number array to comma-separated string', () => {
    expect(serializeCsvIds([1, 2, 3])).toBe('1,2,3');
  });

  it('returns empty string for empty array', () => {
    expect(serializeCsvIds([])).toBe('');
  });

  it('handles single value', () => {
    expect(serializeCsvIds([42])).toBe('42');
  });
});

describe('contactsSearchSchema', () => {
  it('parses valid search params', () => {
    const result = contactsSearchSchema.parse({
      page: 2,
      pageSize: 20,
      search: 'john',
      tags: '1,2',
      segments: '3',
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(result.page).toBe(2);
    expect(result.tags).toBe('1,2');
    expect(result.segments).toBe('3');
    expect(result.status).toBe('active');
    expect(result.startDate).toBe('2026-01-01');
  });

  it('defaults tags and segments to empty string', () => {
    const result = contactsSearchSchema.parse({});
    expect(result.tags).toBe('');
    expect(result.segments).toBe('');
  });

  it('defaults status to all', () => {
    const result = contactsSearchSchema.parse({});
    expect(result.status).toBe('all');
  });

  it('catches invalid status and defaults to all', () => {
    const result = contactsSearchSchema.parse({ status: 'invalid_status' });
    expect(result.status).toBe('all');
  });

  it('accepts all valid status values', () => {
    for (const status of ['all', 'active', 'unsubscribed', 'bounced', 'blocked']) {
      const result = contactsSearchSchema.parse({ status });
      expect(result.status).toBe(status);
    }
  });

  it('defaults dates to empty string', () => {
    const result = contactsSearchSchema.parse({});
    expect(result.startDate).toBe('');
    expect(result.endDate).toBe('');
  });
});
