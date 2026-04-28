import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { SuppressionsPage } from '../suppressions-page';

// ── Mocks ──────────────────────────────────────────────────────────

let mockSuppressedReturn: Record<string, unknown> = {};
let mockBulkSuppressReturn: Record<string, unknown> = {};

vi.mock('../use-suppressions', () => ({
  useSuppressedList: () => mockSuppressedReturn,
  useBulkSuppress: () => mockBulkSuppressReturn,
}));

vi.mock('@/hooks/use-list-search-params', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-list-search-params')>(
    '@/hooks/use-list-search-params',
  );
  return {
    ...actual,
    useListSearchParams: (params: Record<string, unknown>) => ({
      pagination: { pageIndex: 0, pageSize: 20 },
      sorting: [],
      setPagination: vi.fn(),
      setSorting: vi.fn(),
      setSearch: vi.fn(),
      searchParams: params,
    }),
  };
});

// ── Helpers ────────────────────────────────────────────────────────

const defaultSearchParams = {
  page: 1,
  pageSize: 20,
  search: '',
  sort: '',
  order: 'asc' as const,
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

async function renderPage(type: 'unsubscribed' | 'blocked' = 'unsubscribed') {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <SuppressionsPage type={type} searchParams={defaultSearchParams} />
    </QueryClientProvider>,
  );
}

const mockData = {
  data: [
    { id: 1, email: 'john@example.com', unsubscribedAt: '2026-01-15T10:00:00Z' },
    { id: 2, email: 'jane@example.com', unsubscribedAt: '2026-01-16T12:00:00Z' },
  ],
  meta: { total: 2, page: 1, pageSize: 20, pageCount: 1 },
};

const blockedData = {
  data: [{ id: 3, email: 'blocked@example.com', blockedAt: '2026-02-01T08:00:00Z', isBlocked: true }],
  meta: { total: 1, page: 1, pageSize: 20, pageCount: 1 },
};

// ── Tests ──────────────────────────────────────────────────────────

describe('SuppressionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkSuppressReturn = {
      mutate: vi.fn(),
      isPending: false,
    };
  });

  describe('unsubscribed type', () => {
    beforeEach(() => {
      mockSuppressedReturn = {
        data: mockData,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('renders page title for unsubscribed', async () => {
      await renderPage('unsubscribed');
      expect(screen.getByText(/descadastrados/i)).toBeInTheDocument();
    });

    it('renders back link to contacts', async () => {
      await renderPage('unsubscribed');
      const backLink = screen.getByRole('link', { name: /contatos/i });
      expect(backLink).toBeInTheDocument();
    });

    it('renders email column', async () => {
      await renderPage('unsubscribed');
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('shows add button', async () => {
      await renderPage('unsubscribed');
      expect(screen.getByRole('button', { name: /descadastrar/i })).toBeInTheDocument();
    });
  });

  describe('blocked type', () => {
    beforeEach(() => {
      mockSuppressedReturn = {
        data: blockedData,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('renders page title for blocked', async () => {
      await renderPage('blocked');
      expect(screen.getByText(/bloqueados/i)).toBeInTheDocument();
    });

    it('renders blocked email', async () => {
      await renderPage('blocked');
      expect(screen.getByText('blocked@example.com')).toBeInTheDocument();
    });

    it('shows block button', async () => {
      await renderPage('blocked');
      expect(screen.getByRole('button', { name: /bloquear/i })).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading skeleton', async () => {
      mockSuppressedReturn = {
        data: undefined,
        isLoading: true,
        isFetching: true,
        error: null,
        refetch: vi.fn(),
      };
      await renderPage();
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('empty state', () => {
    it('shows empty message when no results', async () => {
      mockSuppressedReturn = {
        data: { data: [], meta: { total: 0, page: 1, pageSize: 20, pageCount: 0 } },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
      await renderPage();
      expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
    });
  });
});
