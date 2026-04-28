// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore, resetAuthStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import TagsPage from '../tags-page';
import type { Tag } from '../types';

// ── Mocks ──────────────────────────────────────────────────────────

const mockMutate = vi.fn();

const mockTags: Tag[] = [
  { id: 1, name: 'VIP Customers', type: 'manual', countContacts: 150 },
  { id: 2, name: 'Newsletter', type: 'auto', countContacts: 3200 },
  { id: 3, name: 'Churned', type: 'tag', countContacts: 42 },
];

let mockListReturn: Record<string, unknown> = {};
let mockDeleteReturn: Record<string, unknown> = {};

vi.mock('../use-tags', () => ({
  useTagsList: () => mockListReturn,
  useDeleteTag: () => mockDeleteReturn,
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

async function renderPage(searchParams = defaultSearchParams) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <TagsPage searchParams={searchParams} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('TagsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();

    mockListReturn = {
      data: { data: mockTags, meta: { total: 3, page: 1, pageSize: 20 } },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };

    mockDeleteReturn = {
      mutate: mockMutate,
      isPending: false,
    };
  });

  describe('list rendering', () => {
    beforeEach(() => {
      authenticateStore({ permissions: ['audience:tags_create'] });
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    it('renders all tag names in the table', async () => {
      await renderPage();
      expect(screen.getByText('VIP Customers')).toBeInTheDocument();
      expect(screen.getByText('Newsletter')).toBeInTheDocument();
      expect(screen.getByText('Churned')).toBeInTheDocument();
    });

    it('renders the search input', async () => {
      await renderPage();
      expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
    });

    it('renders pagination when there is data', async () => {
      await renderPage();
      expect(screen.getByText(/Mostrando 1–3 de 3/)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      authenticateStore();
      mockListReturn = {
        data: { data: [], meta: { total: 0, page: 1, pageSize: 20 } },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('shows empty state when there are no tags', async () => {
      await renderPage();
      expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
    });

    it('shows clear search hint when search is active', async () => {
      await renderPage({ ...defaultSearchParams, search: 'nonexistent' });
      expect(screen.getByText(/limpar busca/i)).toBeInTheDocument();
    });
  });

  describe('create button permissions', () => {
    it('shows create button when user has audience:tags_create permission', async () => {
      authenticateStore({ permissions: ['audience:tags_create'] });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar tag/i })).toBeInTheDocument();
    });

    it('hides create button when user lacks permission', async () => {
      authenticateStore();
      await renderPage();
      expect(screen.queryByRole('link', { name: /criar tag/i })).not.toBeInTheDocument();
    });

    it('shows create button for super_admin regardless of permissions', async () => {
      authenticateStore({ effectiveRole: 'super_admin' });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar tag/i })).toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    beforeEach(() => {
      authenticateStore({ permissions: ['audience:tags_create'] });
    });

    it('opens confirm dialog when delete button is clicked', async () => {
      await renderPage();
      const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });
    });

    it('shows the tag name in the confirmation dialog', async () => {
      await renderPage();
      const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/deseja excluir "VIP Customers"/)).toBeInTheDocument();
      });
    });

    it('calls deleteTag.mutate with tag id when confirmed', async () => {
      await renderPage();
      const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirmar/i });
      fireEvent.click(confirmButton);

      expect(mockMutate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          onSuccess: expect.any(Function),
        }),
      );
    });

    it('closes dialog when cancel is clicked', async () => {
      await renderPage();
      const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancelar/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/tem certeza/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('does not show empty state while loading', async () => {
      mockListReturn = {
        data: undefined,
        isLoading: true,
        isFetching: true,
        error: null,
        refetch: vi.fn(),
      };
      authenticateStore();
      await renderPage();
      expect(screen.queryByText(/nenhum/i)).not.toBeInTheDocument();
    });
  });
});
