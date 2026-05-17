// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { PoolFormPage } from '../pool-form-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockNavigate = vi.fn();

let mockPoolQueryReturn: Record<string, unknown> = {};
let mockSendGridPoolsReturn: Record<string, unknown> = {};

vi.mock('../use-pools', () => ({
  usePool: () => mockPoolQueryReturn,
  useCreatePool: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdatePool: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useSendGridPools: () => mockSendGridPoolsReturn,
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
  };
});

// ── Helpers ────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

async function renderFormPage(poolId?: number) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <PoolFormPage poolId={poolId} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('PoolFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolQueryReturn = {
      data: undefined,
      isLoading: false,
      error: null,
    };
    mockSendGridPoolsReturn = {
      data: [{ name: 'pool-a' }, { name: 'pool-b' }],
      isLoading: false,
    };
  });

  describe('create mode (no poolId)', () => {
    it('renders the create title', async () => {
      await renderFormPage();
      expect(screen.getByText(/criar pool de ip/i)).toBeInTheDocument();
    });

    it('renders an empty form', async () => {
      await renderFormPage();
      const nameInput = screen.getByLabelText('Nome');
      expect(nameInput).toHaveValue('');
    });

    it('shows the create button', async () => {
      await renderFormPage();
      expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
    });
  });

  describe('edit mode (with poolId)', () => {
    it('shows loading skeleton while fetching', async () => {
      mockPoolQueryReturn = {
        data: undefined,
        isLoading: true,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when pool fails to load', async () => {
      mockPoolQueryReturn = {
        data: undefined,
        isLoading: false,
        error: new Error('Not found'),
      };
      await renderFormPage(5);
      expect(screen.getByText(/não foi encontrado/i)).toBeInTheDocument();
    });

    it('pre-fills form with pool data', async () => {
      mockPoolQueryReturn = {
        data: {
          id: 5,
          name: 'Main Pool',
          description: 'Primary pool',
          poolName: 'main-pool',
          isDefault: false,
          ip: '',
          dailyLimit: '1000',
          sendingLimit: '100',
        },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByDisplayValue('Main Pool')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Primary pool')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    });

    it('shows save button instead of create', async () => {
      mockPoolQueryReturn = {
        data: {
          id: 5,
          name: 'Main Pool',
          description: '',
          poolName: 'main-pool',
        },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /criar/i })).not.toBeInTheDocument();
    });

    it('calls updatePool mutation on valid submit', async () => {
      mockPoolQueryReturn = {
        data: {
          id: 5,
          name: 'Main Pool',
          description: '',
          poolName: 'main-pool',
        },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);

      fireEvent.change(screen.getByLabelText('Nome'), {
        target: { value: 'Updated Pool' },
      });
      fireEvent.submit(screen.getByRole('button', { name: /salvar/i }));

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Updated Pool' }),
          expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
      });
    });
  });

  describe('back navigation', () => {
    it('renders back link to pools list', async () => {
      await renderFormPage();
      const backLink = screen.getByRole('link', { name: /pools de ip/i });
      expect(backLink).toBeInTheDocument();
    });
  });
});
