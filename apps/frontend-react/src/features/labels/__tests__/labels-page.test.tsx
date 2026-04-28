// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore, resetAuthStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import LabelsPage from '../labels-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockDeleteMutate = vi.fn();
let mockListQueryReturn: Record<string, unknown> = {};

vi.mock('../use-labels', () => ({
  useLabelsList: () => mockListQueryReturn,
  useDeleteLabel: () => ({
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
};

async function renderPage(searchParams = defaultSearchParams) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <LabelsPage searchParams={searchParams} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('LabelsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListQueryReturn = {
      data: {
        data: [
          { id: 1, name: 'Label A', updatedAt: '2026-01-01T00:00:00Z' },
          { id: 2, name: 'Label B', updatedAt: '2026-01-02T00:00:00Z' },
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
      expect(screen.getByText('Labels')).toBeInTheDocument();
    });

    it('renders labels in the table', async () => {
      authenticateStore({ permissions: ['infra:view'] });
      await renderPage();
      expect(screen.getByText('Label A')).toBeInTheDocument();
      expect(screen.getByText('Label B')).toBeInTheDocument();
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
    it('shows empty state when no labels exist', async () => {
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
    it('shows create button with infra:create permission', async () => {
      authenticateStore({ permissions: ['infra:view', 'infra:create'] });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar/i })).toBeInTheDocument();
    });

    it('hides create button without infra:create permission', async () => {
      authenticateStore({ permissions: ['infra:view'] });
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
      authenticateStore({ permissions: ['infra:view', 'infra:create'] });
      await renderPage();

      const deleteButtons = screen.getAllByText(/excluir/i);
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });
    });

    it('calls delete mutation on confirm', async () => {
      authenticateStore({ permissions: ['infra:view', 'infra:create'] });
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

    it('closes dialog when cancelled', async () => {
      authenticateStore({ permissions: ['infra:view', 'infra:create'] });
      await renderPage();

      const deleteButtons = screen.getAllByText(/excluir/i);
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

      await waitFor(() => {
        expect(screen.queryByText(/tem certeza/i)).not.toBeInTheDocument();
      });
    });
  });
});
