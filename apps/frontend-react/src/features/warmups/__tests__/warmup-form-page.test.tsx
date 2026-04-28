// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { WarmupFormPage } from '../warmup-form-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockNavigate = vi.fn();

let mockWarmupQueryReturn: Record<string, unknown> = {};

vi.mock('../use-warmups', () => ({
  useWarmup: () => mockWarmupQueryReturn,
  useCreateWarmup: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateWarmup: () => ({ mutate: mockUpdateMutate, isPending: false }),
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
  };
});

vi.mock('../use-accounts-list', () => ({
  useAccountsList: () => [
    { value: '1', label: 'Account Alpha' },
    { value: '2', label: 'Account Beta' },
  ],
}));

vi.mock('../use-pools-by-account', () => ({
  usePoolsByAccount: () => ({ data: [], isLoading: false }),
}));

vi.mock('../use-segments-by-account', () => ({
  useSegmentsByAccount: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/components/charts/echarts-base', () => ({
  EChartsBase: ({ height }: { height: number }) => <div data-testid="echarts-container" style={{ height }} />,
}));

// ── Helpers ────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

async function renderFormPage(warmupId?: number) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <WarmupFormPage warmupId={warmupId} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('WarmupFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWarmupQueryReturn = {
      data: undefined,
      isLoading: false,
      error: null,
    };
  });

  describe('create mode (no warmupId)', () => {
    it('renders the create title', async () => {
      await renderFormPage();
      expect(screen.getByText(/criar warmup/i)).toBeInTheDocument();
    });

    it('shows the create button', async () => {
      await renderFormPage();
      expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
    });
  });

  describe('edit mode (with warmupId)', () => {
    it('shows loading skeleton while fetching', async () => {
      mockWarmupQueryReturn = {
        data: undefined,
        isLoading: true,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when warmup fails to load', async () => {
      mockWarmupQueryReturn = {
        data: undefined,
        isLoading: false,
        error: new Error('Not found'),
      };
      await renderFormPage(5);
      expect(screen.getByText(/não foi encontrado/i)).toBeInTheDocument();
    });

    it('pre-fills form with warmup data', async () => {
      mockWarmupQueryReturn = {
        data: {
          id: 5,
          accountId: 1,
          targetAccountId: 2,
          sender: 'warmup@example.com',
          ippool: 'main-pool',
          replyTo: '',
          target: 10000,
          type: 'internal',
          stage: 1,
          description: 'Test warmup',
        },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      // sender/ippool are hidden (set via pool selection), description is visible
      expect(screen.getByDisplayValue('Test warmup')).toBeInTheDocument();
    });

    it('shows save button instead of create', async () => {
      mockWarmupQueryReturn = {
        data: {
          id: 5,
          accountId: 1,
          targetAccountId: 2,
          sender: 'a@b.com',
          ippool: 'main',
          target: 1000,
          type: 'internal',
        },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /criar/i })).not.toBeInTheDocument();
    });
  });

  describe('back navigation', () => {
    it('renders back link to warmups list', async () => {
      await renderFormPage();
      const backLink = screen.getByRole('link', { name: /warmups/i });
      expect(backLink).toBeInTheDocument();
    });
  });
});
