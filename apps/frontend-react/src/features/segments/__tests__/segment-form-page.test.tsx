// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { SegmentFormPage } from '../segment-form-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockNavigate = vi.fn();

let mockSegmentQueryReturn: Record<string, unknown> = {};

vi.mock('../use-segments', () => ({
  useSegment: () => mockSegmentQueryReturn,
  useCreateSegment: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateSegment: () => ({ mutate: mockUpdateMutate, isPending: false }),
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

async function renderFormPage(segmentId?: number) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <SegmentFormPage segmentId={segmentId} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('SegmentFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSegmentQueryReturn = {
      data: undefined,
      isLoading: false,
      error: null,
    };
  });

  describe('create mode (no segmentId)', () => {
    it('renders the create title', async () => {
      await renderFormPage();
      expect(screen.getByText(/criar segmento/i)).toBeInTheDocument();
    });

    it('shows the create button', async () => {
      await renderFormPage();
      expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
    });
  });

  describe('edit mode (with segmentId)', () => {
    it('shows loading skeleton while fetching', async () => {
      mockSegmentQueryReturn = {
        data: undefined,
        isLoading: true,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when segment fails to load', async () => {
      mockSegmentQueryReturn = {
        data: undefined,
        isLoading: false,
        error: new Error('Not found'),
      };
      await renderFormPage(5);
      expect(screen.getByText(/não foi encontrado/i)).toBeInTheDocument();
    });

    it('pre-fills form with segment data', async () => {
      mockSegmentQueryReturn = {
        data: {
          id: 5,
          name: 'Active Users',
          description: 'Users active in last 30 days',
          type: 'segment',
          contactsLimit: 100,
          recurrence: 48,
          addBounced: true,
          addUnsubscribed: false,
          addInvalid: false,
          isRealTimeSegment: false,
          steps: '[]',
        },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByDisplayValue('Active Users')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Users active in last 30 days')).toBeInTheDocument();
    });

    it('shows save button instead of create', async () => {
      mockSegmentQueryReturn = {
        data: {
          id: 5,
          name: 'Test',
          type: 'segment',
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
    it('renders back link to segments list', async () => {
      await renderFormPage();
      const backLink = screen.getByRole('link', { name: /segmentos/i });
      expect(backLink).toBeInTheDocument();
    });
  });
});
