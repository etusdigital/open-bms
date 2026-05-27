// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { LabelFormPage } from '../label-form-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockNavigate = vi.fn();

let mockLabelQueryReturn: Record<string, unknown> = {};

vi.mock('../use-labels', () => ({
  useLabel: () => mockLabelQueryReturn,
  useCreateLabel: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateLabel: () => ({ mutate: mockUpdateMutate, isPending: false }),
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

async function renderFormPage(labelId?: number) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <LabelFormPage labelId={labelId} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('LabelFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLabelQueryReturn = {
      data: undefined,
      isLoading: false,
      error: null,
    };
  });

  describe('create mode (no labelId)', () => {
    it('renders the create title', async () => {
      await renderFormPage();
      expect(screen.getByText(/criar label/i)).toBeInTheDocument();
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

    it('validates required fields on submit', async () => {
      await renderFormPage();

      fireEvent.submit(screen.getByRole('button', { name: /criar/i }));

      await waitFor(() => {
        expect(mockCreateMutate).not.toHaveBeenCalled();
      });
    });
  });

  describe('edit mode (with labelId)', () => {
    it('shows loading skeleton while fetching', async () => {
      mockLabelQueryReturn = {
        data: undefined,
        isLoading: true,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when label fails to load', async () => {
      mockLabelQueryReturn = {
        data: undefined,
        isLoading: false,
        error: new Error('Not found'),
      };
      await renderFormPage(5);
      expect(screen.getByText(/não foi encontrado/i)).toBeInTheDocument();
    });

    it('renders the edit title when label is loaded', async () => {
      mockLabelQueryReturn = {
        data: { id: 5, name: 'Existing Label', description: 'Desc' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
    });

    it('pre-fills form with label data', async () => {
      mockLabelQueryReturn = {
        data: { id: 5, name: 'Existing Label', description: 'Some desc' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByDisplayValue('Existing Label')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Some desc')).toBeInTheDocument();
    });

    it('shows save button instead of create', async () => {
      mockLabelQueryReturn = {
        data: { id: 5, name: 'Existing Label', description: '' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /criar/i })).not.toBeInTheDocument();
    });

    it('calls updateLabel mutation on valid submit', async () => {
      mockLabelQueryReturn = {
        data: { id: 5, name: 'Existing Label', description: '' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);

      fireEvent.change(screen.getByLabelText(/nome/i), {
        target: { value: 'Updated Label' },
      });
      fireEvent.submit(screen.getByRole('button', { name: /salvar/i }));

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith(
          { name: 'Updated Label', description: '' },
          expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
      });
    });

    it('handles null description from API gracefully', async () => {
      mockLabelQueryReturn = {
        data: { id: 5, name: 'Label', description: null },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByDisplayValue('Label')).toBeInTheDocument();
      const descInput = screen.getByLabelText(/descrição/i);
      expect(descInput).toHaveValue('');
    });
  });

  describe('back navigation', () => {
    it('renders back link to labels list', async () => {
      await renderFormPage();
      const backLink = screen.getByRole('link', { name: /labels/i });
      expect(backLink).toBeInTheDocument();
    });
  });
});
