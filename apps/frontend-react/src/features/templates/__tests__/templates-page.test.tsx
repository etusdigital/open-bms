import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import TemplatesPage from '../templates-page';
import type { Template } from '../types';

// ── Mocks ──────────────────────────────────────────────────────────

const mockMutate = vi.fn();
const mockDuplicateMutate = vi.fn();

const mockTemplates: Template[] = [
  { id: 1, name: 'Welcome Email', updatedAt: '2026-01-15T10:00:00Z' },
  { id: 2, name: 'Newsletter', updatedAt: '2026-01-16T12:00:00Z' },
  { id: 3, name: 'Promo Campaign', updatedAt: '2026-01-17T08:00:00Z' },
];

let mockListReturn: Record<string, unknown> = {};
let mockDeleteReturn: Record<string, unknown> = {};
let mockDuplicateReturn: Record<string, unknown> = {};

vi.mock('../use-templates', () => ({
  useTemplatesList: () => mockListReturn,
  useDeleteTemplate: () => mockDeleteReturn,
  useDuplicateTemplate: () => mockDuplicateReturn,
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
      <TemplatesPage searchParams={searchParams} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('TemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockDeleteReturn = {
      mutate: mockMutate,
      isPending: false,
    };
    mockDuplicateReturn = {
      mutate: mockDuplicateMutate,
      isPending: false,
    };
  });

  describe('list rendering', () => {
    beforeEach(() => {
      mockListReturn = {
        data: {
          data: mockTemplates,
          meta: { total: 3, page: 1, pageSize: 20, pageCount: 1 },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Templates')).toBeInTheDocument();
    });

    it('renders all template names in the table', async () => {
      await renderPage();
      expect(screen.getByText('Welcome Email')).toBeInTheDocument();
      expect(screen.getByText('Newsletter')).toBeInTheDocument();
      expect(screen.getByText('Promo Campaign')).toBeInTheDocument();
    });

    it('renders the search input', async () => {
      await renderPage();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders pagination when there is data', async () => {
      await renderPage();
      expect(screen.getByText(/mostrando/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockListReturn = {
        data: {
          data: [],
          meta: { total: 0, page: 1, pageSize: 20, pageCount: 0 },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('shows empty state when there are no templates', async () => {
      await renderPage();
      expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
    });

    it('shows clear search hint when search is active', async () => {
      await renderPage({ ...defaultSearchParams, search: 'test' });
      expect(screen.getByText(/limpar/i)).toBeInTheDocument();
    });
  });

  describe('create button permissions', () => {
    beforeEach(() => {
      mockListReturn = {
        data: {
          data: mockTemplates,
          meta: { total: 3, page: 1, pageSize: 20, pageCount: 1 },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('shows create button when user has messages:create permission', async () => {
      authenticateStore({ permissions: ['messages:view', 'messages:create'] });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar template/i })).toBeInTheDocument();
    });

    it('hides create button when user lacks permission', async () => {
      authenticateStore({ permissions: ['messages:view'] });
      await renderPage();
      expect(screen.queryByRole('link', { name: /criar template/i })).not.toBeInTheDocument();
    });

    it('shows create button for super_admin regardless of permissions', async () => {
      authenticateStore({ effectiveRole: 'super_admin', permissions: [] });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar template/i })).toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    beforeEach(() => {
      authenticateStore({ permissions: ['messages:view', 'messages:create', 'messages:delete'] });
      mockListReturn = {
        data: {
          data: mockTemplates,
          meta: { total: 3, page: 1, pageSize: 20, pageCount: 1 },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('opens confirm dialog when delete button is clicked', async () => {
      await renderPage();
      const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });
    });

    it('calls delete mutation on confirm', async () => {
      await renderPage();
      const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirmar/i });
      fireEvent.click(confirmButton);

      expect(mockMutate).toHaveBeenCalledWith(1, expect.any(Object));
    });
  });

  describe('duplicate flow', () => {
    beforeEach(() => {
      authenticateStore({ permissions: ['messages:view', 'messages:create'] });
      mockListReturn = {
        data: {
          data: mockTemplates,
          meta: { total: 3, page: 1, pageSize: 20, pageCount: 1 },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('calls duplicate mutation when duplicate button is clicked', async () => {
      await renderPage();
      const duplicateButtons = screen.getAllByRole('button', { name: /duplicar/i });
      fireEvent.click(duplicateButtons[0]);

      expect(mockDuplicateMutate).toHaveBeenCalledWith(1, expect.any(Object));
    });
  });
});
