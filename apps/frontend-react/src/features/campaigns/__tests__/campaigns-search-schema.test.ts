import { describe, it, expect } from 'vitest';
import { parseCsvStrings, serializeCsvStrings, campaignsSearchSchema } from '../campaigns-search-schema';

describe('parseCsvStrings', () => {
  it('parses comma-separated string to string array', () => {
    expect(parseCsvStrings('simple,testAB,split')).toEqual(['simple', 'testAB', 'split']);
  });

  it('returns empty array for empty string', () => {
    expect(parseCsvStrings('')).toEqual([]);
  });

  it('filters out empty segments', () => {
    expect(parseCsvStrings('email,,sms')).toEqual(['email', 'sms']);
  });

  it('handles single value', () => {
    expect(parseCsvStrings('email')).toEqual(['email']);
  });

  it('handles trailing comma', () => {
    expect(parseCsvStrings('email,sms,')).toEqual(['email', 'sms']);
  });
});

describe('serializeCsvStrings', () => {
  it('serializes string array to comma-separated string', () => {
    expect(serializeCsvStrings(['simple', 'testAB'])).toBe('simple,testAB');
  });

  it('returns empty string for empty array', () => {
    expect(serializeCsvStrings([])).toBe('');
  });

  it('handles single value', () => {
    expect(serializeCsvStrings(['email'])).toBe('email');
  });
});

describe('campaignsSearchSchema', () => {
  it('parses valid search params', () => {
    const result = campaignsSearchSchema.parse({
      page: 2,
      pageSize: 20,
      search: 'newsletter',
      status: '0,1,5',
      types: 'simple,testAB',
      messages: 'email,sms',
      tags: '1,2',
      segments: '3',
    });

    expect(result.page).toBe(2);
    expect(result.status).toBe('0,1,5');
    expect(result.types).toBe('simple,testAB');
    expect(result.messages).toBe('email,sms');
    expect(result.tags).toBe('1,2');
    expect(result.segments).toBe('3');
  });

  it('defaults all filter fields to empty string', () => {
    const result = campaignsSearchSchema.parse({});

    expect(result.status).toBe('');
    expect(result.types).toBe('');
    expect(result.messages).toBe('');
    expect(result.tags).toBe('');
    expect(result.segments).toBe('');
  });

  it('catches invalid values and defaults to empty string', () => {
    const result = campaignsSearchSchema.parse({
      status: undefined,
      types: null,
      messages: 123,
    });

    expect(result.status).toBe('');
    expect(result.types).toBe('');
    expect(result.messages).toBe('');
  });

  it('preserves base search params', () => {
    const result = campaignsSearchSchema.parse({
      page: 3,
      pageSize: 40,
      search: 'test',
      sort: 'title',
      order: 'desc',
    });

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(40);
    expect(result.search).toBe('test');
    expect(result.sort).toBe('title');
    expect(result.order).toBe('desc');
  });
});
