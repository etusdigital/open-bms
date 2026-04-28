// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore, resetAuthStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import ContactsPage from '../contacts-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockDeleteMutate = vi.fn();
let mockListQueryReturn: Record<string, unknown> = {};
let mockDashboardReturn: Record<string, unknown> = {};

vi.mock('../use-contacts', () => ({
  useContactsList: () => mockListQueryReturn,
  useContactDashboard: () => mockDashboardReturn,
  useDeleteContact: () => ({
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
  tags: '',
  segments: '',
  status: 'all' as const,
  startDate: '',
  endDate: '',
};

async function renderPage(searchParams = defaultSearchParams) {
  const result = await renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <ContactsPage searchParams={searchParams} />
    </QueryClientProvider>,
  );
  // Flush pending microtasks and Radix UI timer-based state updates (Tooltip, Select, Presence)
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('ContactsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockDashboardReturn = {
      data: { total: 1000, subscribedToday: 5, active: 800, providers: {} },
      isLoading: false,
    };
    mockListQueryReturn = {
      data: {
        data: [
          {
            id: 1,
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Doe',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z',
          },
          {
            id: 2,
            email: 'jane@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            isActive: false,
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

  afterEach(async () => {
    // Flush any pending Radix UI timer-based state updates before cleanup
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    cleanup();
    vi.useRealTimers();
    resetAuthStore();
  });

  describe('list rendering', () => {
    it('renders the page title', async () => {
      authenticateStore({ permissions: ['audience:contacts_view'] });
      await renderPage();
      expect(screen.getByRole('heading', { name: /contatos/i })).toBeInTheDocument();
    });

    it('renders contacts in the table', async () => {
      authenticateStore({ permissions: ['audience:contacts_view'] });
      await renderPage();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('shows loading state', async () => {
      authenticateStore({ permissions: ['audience:contacts_view'] });
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

  describe('dashboard cards', () => {
    it('renders dashboard stats', async () => {
      authenticateStore({ permissions: ['audience:contacts_view'] });
      await renderPage();
      expect(screen.getByText('1,000')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no contacts exist', async () => {
      authenticateStore({ permissions: ['audience:contacts_view'] });
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
  });

  describe('permissions', () => {
    it('shows import button with audience:contacts_import permission', async () => {
      authenticateStore({ permissions: ['audience:contacts_view', 'audience:contacts_import'] });
      await renderPage();
      expect(screen.getByRole('link', { name: /importar/i })).toBeInTheDocument();
    });

    it('hides import button without audience:contacts_import permission', async () => {
      authenticateStore({ permissions: ['audience:contacts_view'] });
      await renderPage();
      expect(screen.queryByRole('link', { name: /importar/i })).not.toBeInTheDocument();
    });

    it('super admin can see import button', async () => {
      authenticateStore({ effectiveRole: 'super_admin' });
      await renderPage();
      expect(screen.getByRole('link', { name: /importar/i })).toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    it('shows confirm dialog when delete is clicked', async () => {
      authenticateStore({ permissions: ['audience:contacts_view', 'audience:contacts_import'] });
      await renderPage();

      const deleteButtons = screen.getAllByText(/excluir/i);
      await act(async () => {
        fireEvent.click(deleteButtons[0]);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
    });
  });
});
