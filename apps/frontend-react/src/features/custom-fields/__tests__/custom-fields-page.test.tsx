// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore, resetAuthStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import CustomFieldsPage from '../custom-fields-page';
import type { CustomField } from '../types';

// ── Mocks ──────────────────────────────────────────────────────────

const mockMutate = vi.fn();

const mockCustomFields: CustomField[] = [
  { id: 1, title: 'Color', name: 'color', type: 'text' },
  { id: 2, title: 'Age', name: 'age', type: 'number' },
  { id: 3, title: 'Birthday', name: 'birthday', type: 'date' },
];

let mockListReturn: Record<string, unknown> = {};
let mockDeleteReturn: Record<string, unknown> = {};

vi.mock('../use-custom-fields', () => ({
  useCustomFieldsList: () => mockListReturn,
  useDeleteCustomField: () => mockDeleteReturn,
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
      <CustomFieldsPage searchParams={searchParams} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CustomFieldsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();

    mockListReturn = {
      data: { data: mockCustomFields, meta: { total: 3, page: 1, pageSize: 20 } },
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
      authenticateStore({ permissions: ['audience:custom_fields_create'] });
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Campos Personalizados')).toBeInTheDocument();
    });

    it('renders all custom field titles in the table', async () => {
      await renderPage();
      expect(screen.getByText('Color')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
      expect(screen.getByText('Birthday')).toBeInTheDocument();
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

    it('shows empty state when there are no custom fields', async () => {
      await renderPage();
      expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
    });

    it('shows clear search hint when search is active', async () => {
      await renderPage({ ...defaultSearchParams, search: 'nonexistent' });
      expect(screen.getByText(/limpar busca/i)).toBeInTheDocument();
    });
  });

  describe('create button permissions', () => {
    it('shows create button when user has audience:custom_fields_create permission', async () => {
      authenticateStore({ permissions: ['audience:custom_fields_create'] });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar campo/i })).toBeInTheDocument();
    });

    it('hides create button when user lacks permission', async () => {
      authenticateStore();
      await renderPage();
      expect(screen.queryByRole('link', { name: /criar campo/i })).not.toBeInTheDocument();
    });

    it('shows create button for super_admin regardless of permissions', async () => {
      authenticateStore({ effectiveRole: 'super_admin' });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar campo/i })).toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    beforeEach(() => {
      authenticateStore({ permissions: ['audience:custom_fields_create'] });
    });

    it('opens confirm dialog when delete button is clicked', async () => {
      await renderPage();
      const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
      });
    });

    it('shows the custom field name in the confirmation dialog', async () => {
      await renderPage();
      const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/deseja excluir "Color"/)).toBeInTheDocument();
      });
    });

    it('calls deleteCustomField.mutate with id when confirmed', async () => {
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
