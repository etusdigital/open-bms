// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore, resetAuthStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import SegmentsPage from '../segments-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockDeleteMutate = vi.fn();
const mockCopyMutate = vi.fn();
const mockRunMutate = vi.fn();
let mockListQueryReturn: Record<string, unknown> = {};

vi.mock('../use-segments', () => ({
  useSegmentsList: () => mockListQueryReturn,
  useDeleteSegment: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
  useCopySegment: () => ({
    mutate: mockCopyMutate,
    isPending: false,
  }),
  useRunSegment: () => ({
    mutate: mockRunMutate,
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
};

async function renderPage(searchParams = defaultSearchParams) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <SegmentsPage searchParams={searchParams} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('SegmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListQueryReturn = {
      data: {
        data: [
          {
            id: 1,
            name: 'Active Users',
            type: 'segment',
            status: 'active',
            lastCount: 1500,
            lastRunDate: '2026-01-01T00:00:00Z',
          },
          { id: 2, name: 'New Leads', type: 'segment', status: 'inactive', lastCount: 0 },
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
      authenticateStore({ permissions: ['audience:segments_view'] });
      await renderPage();
      expect(screen.getByText(/segmentos/i)).toBeInTheDocument();
    });

    it('renders segments in the table', async () => {
      authenticateStore({ permissions: ['audience:segments_view'] });
      await renderPage();
      expect(screen.getByText('Active Users')).toBeInTheDocument();
      expect(screen.getByText('New Leads')).toBeInTheDocument();
    });

    it('shows loading state', async () => {
      authenticateStore({ permissions: ['audience:segments_view'] });
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
    it('shows empty state when no segments exist', async () => {
      authenticateStore({ permissions: ['audience:segments_view'] });
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
      authenticateStore({ permissions: ['audience:segments_view'] });
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
    it('shows create button with audience:segments_execute permission', async () => {
      authenticateStore({ permissions: ['audience:segments_view', 'audience:segments_execute'] });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar/i })).toBeInTheDocument();
    });

    it('hides create button without audience:segments_execute permission', async () => {
      authenticateStore({ permissions: ['audience:segments_view'] });
      await renderPage();
      expect(screen.queryByRole('link', { name: /criar/i })).not.toBeInTheDocument();
    });

    it('super admin can see create button', async () => {
      authenticateStore({ effectiveRole: 'super_admin' });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar/i })).toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    it('shows confirm dialog when delete is clicked', async () => {
      authenticateStore({ permissions: ['audience:segments_view', 'audience:segments_execute'] });
      await renderPage();

      const deleteButtons = screen.getAllByText(/excluir/i);
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });
    });

    it('calls delete mutation on confirm', async () => {
      authenticateStore({ permissions: ['audience:segments_view', 'audience:segments_execute'] });
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
