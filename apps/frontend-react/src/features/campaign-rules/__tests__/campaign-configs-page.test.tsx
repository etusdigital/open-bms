import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import CampaignConfigsPage from '../campaign-configs-page';
import type { CampaignConfig } from '../types';

const mockMutate = vi.fn();
const mockDuplicateMutate = vi.fn();

const mockConfigs: CampaignConfig[] = [
  {
    id: 1,
    name: 'Config Alpha',
    description: 'Desc A',
    configs: {},
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 2,
    name: 'Config Beta',
    description: 'Desc B',
    configs: {},
    updatedAt: '2026-01-16T12:00:00Z',
  },
];

let mockListReturn: Record<string, unknown> = {};
let mockDeleteReturn: Record<string, unknown> = {};
let mockDuplicateReturn: Record<string, unknown> = {};

vi.mock('../use-campaign-configs', () => ({
  useCampaignConfigsList: () => mockListReturn,
  useDeleteCampaignConfig: () => mockDeleteReturn,
  useDuplicateCampaignConfig: () => mockDuplicateReturn,
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
      <CampaignConfigsPage searchParams={searchParams} />
    </QueryClientProvider>,
  );
}

describe('CampaignConfigsPage', () => {
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
          data: mockConfigs,
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
      expect(screen.getByText('Campaign Configs')).toBeInTheDocument();
    });

    it('renders all config names', async () => {
      await renderPage();
      expect(screen.getByText('Config Alpha')).toBeInTheDocument();
      expect(screen.getByText('Config Beta')).toBeInTheDocument();
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

    it('shows empty state when there are no configs', async () => {
      await renderPage();
      expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
    });
  });

  describe('permissions', () => {
    beforeEach(() => {
      mockListReturn = {
        data: {
          data: mockConfigs,
          meta: { total: 2, page: 1, pageSize: 20, pageCount: 1 },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('shows create button when user has infra:manage', async () => {
      authenticateStore({ permissions: ['infra:view', 'infra:manage'] });
      await renderPage();
      expect(screen.getByRole('link', { name: /criar configuração/i })).toBeInTheDocument();
    });

    it('hides create button when user lacks permission', async () => {
      authenticateStore({ permissions: ['infra:view'] });
      await renderPage();
      expect(screen.queryByRole('link', { name: /criar configuração/i })).not.toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    beforeEach(() => {
      authenticateStore({ permissions: ['infra:view', 'infra:manage'] });
      mockListReturn = {
        data: {
          data: mockConfigs,
          meta: { total: 2, page: 1, pageSize: 20, pageCount: 1 },
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('opens confirm dialog and calls delete on confirm', async () => {
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
      authenticateStore({ permissions: ['infra:view', 'infra:manage'] });
      mockListReturn = {
        data: {
          data: mockConfigs,
          meta: { total: 2, page: 1, pageSize: 20, pageCount: 1 },
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
