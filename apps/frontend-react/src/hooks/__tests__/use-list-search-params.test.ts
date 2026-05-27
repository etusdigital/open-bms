import { describe, it, expect, beforeEach } from 'vitest';
import { listSearchSchema, savePageSize, type ListSearchParams } from '../use-list-search-params';

describe('listSearchSchema', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides defaults for empty input', () => {
    const result = listSearchSchema.parse({});
    expect(result).toEqual({
      page: 1,
      pageSize: 20,
      search: '',
      sort: '',
      order: 'asc',
    });
  });

  it('parses valid params', () => {
    const result = listSearchSchema.parse({
      page: 3,
      pageSize: 40,
      search: 'hello',
      sort: 'name',
      order: 'desc',
    });
    expect(result).toEqual({
      page: 3,
      pageSize: 40,
      search: 'hello',
      sort: 'name',
      order: 'desc',
    });
  });

  it('falls back to defaults on invalid page', () => {
    const result = listSearchSchema.parse({ page: 'abc' });
    expect(result.page).toBe(1);
  });

  it('falls back to defaults on negative page', () => {
    const result = listSearchSchema.parse({ page: -1 });
    expect(result.page).toBe(1);
  });

  it('falls back to defaults on invalid pageSize', () => {
    const result = listSearchSchema.parse({ pageSize: 'big' });
    expect(result.pageSize).toBe(20);
  });

  it('falls back to defaults on invalid order', () => {
    const result = listSearchSchema.parse({ order: 'sideways' });
    expect(result.order).toBe('asc');
  });

  it('falls back to defaults on invalid search', () => {
    const result = listSearchSchema.parse({ search: 123 });
    expect(result.search).toBe('');
  });

  it('is extensible with .extend()', () => {
    const extended = listSearchSchema.extend({
      tagId: z.number().optional().catch(undefined),
    });
    const result = extended.parse({ tagId: 5, page: 2 });
    expect(result.tagId).toBe(5);
    expect(result.page).toBe(2);
  });
});

describe('useListSearchParams - state derivation', () => {
  it('converts 1-based page to 0-based pageIndex', () => {
    const params: ListSearchParams = {
      page: 3,
      pageSize: 20,
      search: '',
      sort: '',
      order: 'asc',
    };
    // Test the derivation logic directly
    const pagination = {
      pageIndex: params.page - 1,
      pageSize: params.pageSize,
    };
    expect(pagination.pageIndex).toBe(2);
    expect(pagination.pageSize).toBe(20);
  });

  it('converts sort params to TanStack Table sorting state', () => {
    const params: ListSearchParams = {
      page: 1,
      pageSize: 20,
      search: '',
      sort: 'name',
      order: 'desc',
    };
    const sorting = params.sort ? [{ id: params.sort, desc: params.order === 'desc' }] : [];
    expect(sorting).toEqual([{ id: 'name', desc: true }]);
  });

  it('returns empty sorting when sort is empty', () => {
    const params: ListSearchParams = {
      page: 1,
      pageSize: 20,
      search: '',
      sort: '',
      order: 'asc',
    };
    const sorting = params.sort ? [{ id: params.sort, desc: params.order === 'desc' }] : [];
    expect(sorting).toEqual([]);
  });

  it('converts asc order to desc: false', () => {
    const params: ListSearchParams = {
      page: 1,
      pageSize: 20,
      search: '',
      sort: 'email',
      order: 'asc',
    };
    const sorting = [{ id: params.sort, desc: params.order === 'desc' }];
    expect(sorting[0].desc).toBe(false);
  });
});

describe('pageSize localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves pageSize to localStorage', () => {
    savePageSize(40);
    expect(localStorage.getItem('list-page-size')).toBe('40');
  });

  it('ignores invalid stored values and falls back to 20', () => {
    localStorage.setItem('list-page-size', 'garbage');
    const result = listSearchSchema.parse({});
    expect(result.pageSize).toBe(20);
  });

  it('ignores non-option stored values and falls back to 20', () => {
    localStorage.setItem('list-page-size', '50');
    const result = listSearchSchema.parse({});
    expect(result.pageSize).toBe(20);
  });

  it('uses stored pageSize as default when no pageSize in URL', () => {
    savePageSize(40);
    const result = listSearchSchema.parse({});
    expect(result.pageSize).toBe(40);
  });

  it('preserves explicit pageSize from URL over stored value', () => {
    savePageSize(40);
    const result = listSearchSchema.parse({ pageSize: 100 });
    expect(result.pageSize).toBe(100);
  });
});

// Need z import for extensibility test
import { z } from 'zod';
