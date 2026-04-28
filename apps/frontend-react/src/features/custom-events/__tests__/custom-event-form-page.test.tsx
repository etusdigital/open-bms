// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { CustomEventFormPage } from '../custom-event-form-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockNavigate = vi.fn();

let mockEventQueryReturn: Record<string, unknown> = {};

vi.mock('../use-custom-events', () => ({
  useCustomEvent: () => mockEventQueryReturn,
  useCreateCustomEvent: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateCustomEvent: () => ({ mutate: mockUpdateMutate, isPending: false }),
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

async function renderFormPage(customEventId?: number) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <CustomEventFormPage customEventId={customEventId} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CustomEventFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventQueryReturn = {
      data: undefined,
      isLoading: false,
      error: null,
    };
  });

  describe('create mode (no customEventId)', () => {
    it('renders the create title', async () => {
      await renderFormPage();
      expect(screen.getByText(/criar custom event/i)).toBeInTheDocument();
    });

    it('renders an empty form', async () => {
      await renderFormPage();
      const nameInput = screen.getByLabelText(/nome/i);
      expect(nameInput).toHaveValue('');
    });

    it('shows the create button', async () => {
      await renderFormPage();
      expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
    });
  });

  describe('edit mode (with customEventId)', () => {
    it('shows loading skeleton while fetching', async () => {
      mockEventQueryReturn = {
        data: undefined,
        isLoading: true,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when event fails to load', async () => {
      mockEventQueryReturn = {
        data: undefined,
        isLoading: false,
        error: new Error('Not found'),
      };
      await renderFormPage(5);
      expect(screen.getByText(/não foi encontrado/i)).toBeInTheDocument();
    });

    it('pre-fills form with event data', async () => {
      mockEventQueryReturn = {
        data: { id: 5, name: 'page_view', description: 'User viewed a page' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByDisplayValue('page_view')).toBeInTheDocument();
      expect(screen.getByDisplayValue('User viewed a page')).toBeInTheDocument();
    });

    it('shows save button instead of create', async () => {
      mockEventQueryReturn = {
        data: { id: 5, name: 'page_view', description: '' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /criar/i })).not.toBeInTheDocument();
    });

    it('calls updateCustomEvent mutation on valid submit', async () => {
      mockEventQueryReturn = {
        data: { id: 5, name: 'page_view', description: '' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);

      fireEvent.change(screen.getByLabelText(/nome/i), {
        target: { value: 'updated_event' },
      });
      fireEvent.submit(screen.getByRole('button', { name: /salvar/i }));

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith(
          { name: 'updated_event', description: '' },
          expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
      });
    });

    it('handles null description from API gracefully', async () => {
      mockEventQueryReturn = {
        data: { id: 5, name: 'event', description: null },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByDisplayValue('event')).toBeInTheDocument();
      const descInput = screen.getByLabelText(/descrição/i);
      expect(descInput).toHaveValue('');
    });
  });

  describe('back navigation', () => {
    it('renders back link to custom events list', async () => {
      await renderFormPage();
      const backLink = screen.getByRole('link', { name: /custom events/i });
      expect(backLink).toBeInTheDocument();
    });
  });
});
