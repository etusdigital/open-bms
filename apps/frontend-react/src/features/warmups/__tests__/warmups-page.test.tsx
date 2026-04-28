// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore, resetAuthStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import WarmupsPage from '../warmups-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockDeleteMutate = vi.fn();
let mockListQueryReturn: Record<string, unknown> = {};

vi.mock('../use-warmups', () => ({
  useWarmupsList: () => mockListQueryReturn,
  useDeleteWarmup: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// ── Helpers ────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const defaultSearchParams = {
  page: 1,
  pageSize: 20,
  search: '',
  sort: '',
  order: 'asc' as const,
  status: '',
};

async function renderPage(searchParams = defaultSearchParams) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <WarmupsPage searchParams={searchParams} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

// Radix UI Select/Tooltip components schedule internal state updates via
// layout effects and ResizeObserver that fire outside React's act() boundary.
// These are harmless in tests and cannot be awaited, so we suppress them.
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('not wrapped in act(')) return;
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('WarmupsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListQueryReturn = {
      data: {
        data: [
          {
            id: 1,
            sender: 'warmup@a.com',
            status: 'running',
            target: 10000,
            currentSend: 5000,
            createdAt: '2026-01-01T00:00:00Z',
          },
          {
            id: 2,
            sender: 'warmup@b.com',
            status: 'notStarted',
            target: 50000,
            currentSend: 0,
            createdAt: '2026-01-02T00:00:00Z',
          },
        ],
        meta: { total: 2, page: 1, pageSize: 20 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  afterEach(() => {
    resetAuthStore();
  });

  describe('list rendering', () => {
    it('renders the page title', async () => {
      authenticateStore({ permissions: ['infra:view'] });
      await renderPage();
      expect(screen.getByText(/warmups/i)).toBeInTheDocument();
    });

    it('renders warmups in the table', async () => {
      authenticateStore({ permissions: ['infra:view'] });
      await renderPage();
      expect(screen.getByText('warmup@a.com')).toBeInTheDocument();
      expect(screen.getByText('warmup@b.com')).toBeInTheDocument();
    });

    it('shows loading state', async () => {
      authenticateStore({ permissions: ['infra:view'] });
      mockListQueryReturn = {
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
    it('shows empty state when no warmups exist', async () => {
      authenticateStore({ permissions: ['infra:view'] });
      mockListQueryReturn = {
        data: { data: [], meta: { total: 0, page: 1, pageSize: 20 } },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
      await renderPage();
      expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
    });

    it('shows search-specific empty state', async () => {
      authenticateStore({ permissions: ['infra:view'] });
      mockListQueryReturn = {
        data: { data: [], meta: { total: 0, page: 1, pageSize: 20 } },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
      await renderPage({ ...defaultSearchParams, search: 'xyz' });
      expect(screen.getByText(/limpar/i)).toBeInTheDocument();
    });
  });

  describe('permissions', () => {
    it('shows create button for super admin', async () => {
      authenticateStore({ effectiveRole: 'super_admin' });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar/i })).toBeInTheDocument();
    });

    it('hides create button for non-super-admin', async () => {
      authenticateStore({ effectiveRole: 'admin', permissions: ['infra:view', 'infra:manage'] });
      await renderPage();
      expect(screen.queryByRole('link', { name: /criar/i })).not.toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    it('shows confirm dialog when delete is clicked', async () => {
      authenticateStore({ effectiveRole: 'super_admin' });
      await renderPage();

      const deleteButtons = screen.getAllByText(/excluir/i);
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });
    });

    it('calls delete mutation on confirm', async () => {
      authenticateStore({ effectiveRole: 'super_admin' });
      await renderPage();

      const deleteButtons = screen.getAllByText(/excluir/i);
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
      expect(mockDeleteMutate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          onSuccess: expect.any(Function),
        }),
      );
    });
  });
});
