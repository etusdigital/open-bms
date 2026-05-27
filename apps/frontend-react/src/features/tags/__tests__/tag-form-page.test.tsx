// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { TagFormPage } from '../tag-form-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockNavigate = vi.fn();

let mockTagQueryReturn: Record<string, unknown> = {};

vi.mock('../use-tags', () => ({
  useTag: () => mockTagQueryReturn,
  useCreateTag: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateTag: () => ({ mutate: mockUpdateMutate, isPending: false }),
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

async function renderFormPage(tagId?: number) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <TagFormPage tagId={tagId} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('TagFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTagQueryReturn = {
      data: undefined,
      isLoading: false,
      error: null,
    };
  });

  describe('create mode (no tagId)', () => {
    it('renders the create title', async () => {
      await renderFormPage();
      expect(screen.getByText(/criar tag/i)).toBeInTheDocument();
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

    it('calls createTag mutation on valid submit', async () => {
      await renderFormPage();

      fireEvent.change(screen.getByLabelText(/nome/i), {
        target: { value: 'New Tag' },
      });
      fireEvent.submit(screen.getByRole('button', { name: /criar/i }));

      await waitFor(() => {
        expect(mockCreateMutate).toHaveBeenCalledWith(
          { name: 'New Tag', description: '' },
          expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
      });
    });
  });

  describe('edit mode (with tagId)', () => {
    it('shows loading skeleton while fetching tag', async () => {
      mockTagQueryReturn = {
        data: undefined,
        isLoading: true,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
      // Skeleton renders animated pulse elements
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when tag fails to load', async () => {
      mockTagQueryReturn = {
        data: undefined,
        isLoading: false,
        error: new Error('Not found'),
      };
      await renderFormPage(5);
      expect(screen.getByText(/não foi encontrado/i)).toBeInTheDocument();
    });

    it('renders the edit title when tag is loaded', async () => {
      mockTagQueryReturn = {
        data: { id: 5, name: 'Existing Tag', description: 'Desc' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
    });

    it('pre-fills form with tag data', async () => {
      mockTagQueryReturn = {
        data: { id: 5, name: 'Existing Tag', description: 'Some description' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByDisplayValue('Existing Tag')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Some description')).toBeInTheDocument();
    });

    it('shows save button instead of create', async () => {
      mockTagQueryReturn = {
        data: { id: 5, name: 'Existing Tag', description: '' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /criar/i })).not.toBeInTheDocument();
    });

    it('calls updateTag mutation on valid submit', async () => {
      mockTagQueryReturn = {
        data: { id: 5, name: 'Existing Tag', description: '' },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);

      fireEvent.change(screen.getByLabelText(/nome/i), {
        target: { value: 'Updated Tag' },
      });
      fireEvent.submit(screen.getByRole('button', { name: /salvar/i }));

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith(
          { name: 'Updated Tag', description: '' },
          expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
      });
    });

    it('handles null description from API gracefully', async () => {
      mockTagQueryReturn = {
        data: { id: 5, name: 'Tag', description: null },
        isLoading: false,
        error: null,
      };
      await renderFormPage(5);
      expect(screen.getByDisplayValue('Tag')).toBeInTheDocument();
      // Description should default to empty string
      const descInput = screen.getByLabelText(/descrição/i);
      expect(descInput).toHaveValue('');
    });
  });

  describe('back navigation', () => {
    it('renders back link to tags list', async () => {
      await renderFormPage();
      const backLink = screen.getByRole('link', { name: /tags/i });
      expect(backLink).toBeInTheDocument();
    });
  });
});
