import { describe, it, expect } from 'vitest';
import { bmsHttpParamsDefault, getBmsHttpParamsToString } from './BmsGateway.utils';

describe('bmsHttpParamsDefault', () => {
  it('has expected default values', () => {
    expect(bmsHttpParamsDefault.page).toBe(1);
    expect(bmsHttpParamsDefault.itemsPerPage).toBe(10);
    expect(bmsHttpParamsDefault.search).toBe('');
    expect(bmsHttpParamsDefault.totalItems).toBeUndefined();
    expect(bmsHttpParamsDefault.totalPages).toBeUndefined();
  });
});

describe('getBmsHttpParamsToString', () => {
  it('builds query string with page and itemsPerPage', () => {
    const result = getBmsHttpParamsToString({ page: 1, itemsPerPage: 20 });
    expect(result).toContain('page=1');
    expect(result).toContain('itemsPerPage=20');
  });

  it('includes search when provided', () => {
    const result = getBmsHttpParamsToString({ page: 1, search: 'test' });
    expect(result).toContain('search=test');
  });

  it('omits search when empty string', () => {
    const result = getBmsHttpParamsToString({ page: 1, search: '' });
    expect(result).not.toContain('search=');
  });

  it('includes sortBy and order when provided', () => {
    const result = getBmsHttpParamsToString({ page: 1, sortBy: 'name', order: 'asc' });
    expect(result).toContain('sortBy=name');
    expect(result).toContain('order=asc');
  });

  it('includes totalPages=0', () => {
    const result = getBmsHttpParamsToString({ page: 1, totalPages: 0 });
    expect(result).toContain('totalPages=0');
  });

  it('includes totalItems=0', () => {
    const result = getBmsHttpParamsToString({ page: 1, totalItems: 0 });
    expect(result).toContain('totalItems=0');
  });
});
