import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import CampaignRulesPage from '../campaign-rules-page';
import type { CampaignRule } from '../types';

const mockMutate = vi.fn();

const mockRules: CampaignRule[] = [
  {
    id: 1,
    name: 'Weekday Rule',
    description: 'Mon-Fri',
    weekDays: [1, 2, 3, 4, 5],
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 2,
    name: 'Weekend Rule',
    description: 'Sat-Sun',
    weekDays: [0, 6],
    updatedAt: '2026-01-16T12:00:00Z',
  },
];

let mockListReturn: Record<string, unknown> = {};
let mockDeleteReturn: Record<string, unknown> = {};

vi.mock('../use-campaign-rules', () => ({
  useCampaignRulesList: () => mockListReturn,
  useDeleteCampaignRule: () => mockDeleteReturn,
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
      <CampaignRulesPage searchParams={searchParams} />
    </QueryClientProvider>,
  );
}

describe('CampaignRulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockDeleteReturn = {
      mutate: mockMutate,
      isPending: false,
    };
  });

  describe('list rendering', () => {
    beforeEach(() => {
      mockListReturn = {
        data: {
          data: mockRules,
          meta: { total: 2, page: 1, pageSize: 20, pageCount: 1 },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Campaign Rules')).toBeInTheDocument();
    });

    it('renders all rule names in the table', async () => {
      await renderPage();
      expect(screen.getByText('Weekday Rule')).toBeInTheDocument();
      expect(screen.getByText('Weekend Rule')).toBeInTheDocument();
    });

    it('renders the search input', async () => {
      await renderPage();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
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

    it('shows empty state when there are no rules', async () => {
      await renderPage();
      expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
    });
  });

  describe('create button permissions', () => {
    beforeEach(() => {
      mockListReturn = {
        data: {
          data: mockRules,
          meta: { total: 2, page: 1, pageSize: 20, pageCount: 1 },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('shows create button when user has infra:manage permission', async () => {
      authenticateStore({ permissions: ['infra:view', 'infra:manage'] });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar regra/i })).toBeInTheDocument();
    });

    it('hides create button when user lacks permission', async () => {
      authenticateStore({ permissions: ['infra:view'] });
      await renderPage();
      expect(screen.queryByRole('link', { name: /criar regra/i })).not.toBeInTheDocument();
    });

    it('shows create button for super_admin', async () => {
      authenticateStore({ effectiveRole: 'super_admin', permissions: [] });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar regra/i })).toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    beforeEach(() => {
      authenticateStore({ permissions: ['infra:view', 'infra:manage'] });
      mockListReturn = {
        data: {
          data: mockRules,
          meta: { total: 2, page: 1, pageSize: 20, pageCount: 1 },
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
});
