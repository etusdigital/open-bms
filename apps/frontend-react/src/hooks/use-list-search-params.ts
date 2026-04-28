import { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import type { PaginationState, SortingState, Updater } from '@tanstack/react-table';

export const PAGE_SIZE_OPTIONS = [10, 20, 40, 100] as const;

const PAGE_SIZE_STORAGE_KEY = 'list-page-size';
const DEFAULT_PAGE_SIZE = 20;

function getStoredPageSize(): number {
  try {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (!stored) return DEFAULT_PAGE_SIZE;
    const parsed = Number(stored);
    return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function savePageSize(size: number) {
  try {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
  } catch {
    // localStorage unavailable
  }
}

export const listSearchSchema = z.object({
  page: z.number().int().positive().default(1).catch(1),
  pageSize: z.preprocess(
    (val) => (val == null ? getStoredPageSize() : val),
    z.number().int().positive().default(DEFAULT_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  ),
  search: z.string().default('').catch(''),
  sort: z.string().default('').catch(''),
  order: z.enum(['asc', 'desc']).default('asc').catch('asc'),
});

export type ListSearchParams = z.infer<typeof listSearchSchema>;

/**
 * Bridges TanStack Router search params with TanStack Table state.
 * Handles 0-based (table) ↔ 1-based (URL) page conversion and URL persistence.
 * Search debouncing is handled by DataTableSearch, not here.
 */
export function useListSearchParams(searchParams: ListSearchParams) {
  const navigate = useNavigate();

  // Derive TanStack Table pagination state (0-based pageIndex)
  const pagination = useMemo<PaginationState>(
    () => ({
      pageIndex: searchParams.page - 1,
      pageSize: searchParams.pageSize,
    }),
    [searchParams.page, searchParams.pageSize],
  );

  // Derive TanStack Table sorting state
  const sorting = useMemo<SortingState>(
    () => (searchParams.sort ? [{ id: searchParams.sort, desc: searchParams.order === 'desc' }] : []),
    [searchParams.sort, searchParams.order],
  );

  const setPagination = useCallback(
    (updater: Updater<PaginationState>) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      if (next.pageSize !== pagination.pageSize) {
        savePageSize(next.pageSize);
      }
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          page: next.pageIndex + 1,
          pageSize: next.pageSize,
        }),
      } as never);
    },
    [navigate, pagination],
  );

  const setSorting = useCallback(
    (updater: Updater<SortingState>) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const col = next[0];
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          sort: col?.id ?? '',
          order: col?.desc ? 'desc' : 'asc',
          page: 1,
        }),
      } as never);
    },
    [navigate, sorting],
  );

  const setSearch = useCallback(
    (value: string) => {
      // No debounce here — DataTableSearch already debounces before calling this
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          search: value,
          page: 1,
        }),
        replace: false,
      } as never);
    },
    [navigate],
  );

  return {
    pagination,
    sorting,
    searchParams,
    setPagination,
    setSorting,
    setSearch,
  };
}
