import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import AutomationsPage from '../automations-page';
import type { PaginatedResponse } from '@/types';
import type { Automation } from '../types';

let mockQueryReturn: Record<string, unknown> = {};
const mockDeleteMutate = vi.fn();
const mockDuplicateMutate = vi.fn();

vi.mock('../use-automations', () => ({
  useAutomationsList: () => mockQueryReturn,
  useDeleteAutomation: () => ({ mutate: mockDeleteMutate, isPending: false }),
  useDuplicateAutomation: () => ({ mutate: mockDuplicateMutate, isPending: false }),
  useToggleAutomation: () => ({ mutate: vi.fn(), isPending: false }),
}));

function renderPage() {
  return renderWithRouter(
    <AutomationsPage searchParams={{ page: 1, pageSize: 10, search: '', sort: '', order: 'asc', status: 'active' }} />,
  );
}

const mockAutomations: PaginatedResponse<Automation> = {
  data: [
    {
      id: 1,
      title: 'Welcome Series',
      description: 'Onboarding emails',
      type: 'email',
      isActive: true,
      updatedAt: '2026-03-13T10:00:00Z',
    },
    {
      id: 2,
      title: 'Re-engagement',
      type: 'email',
      isActive: false,
      updatedAt: '2026-03-12T10:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, lastPage: 1, itemsPerPage: 10 },
};

describe('AutomationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore({
      permissions: ['automations:view', 'automations:create', 'automations:delete'],
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockQueryReturn = { data: undefined, isLoading: true, error: null };
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Automações')).toBeInTheDocument();
    });

    it('shows loading skeletons', async () => {
      await renderPage();
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: { data: [], meta: { total: 0, page: 1, lastPage: 1, itemsPerPage: 10 } },
        isLoading: false,
        error: null,
      };
    });

    it('shows empty message', async () => {
      await renderPage();
      expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockAutomations, isLoading: false, isFetching: false, error: null };
    });

    it('renders automation titles', async () => {
      await renderPage();
      expect(screen.getByText('Welcome Series')).toBeInTheDocument();
      expect(screen.getByText('Re-engagement')).toBeInTheDocument();
    });

    it('shows status badges', async () => {
      await renderPage();
      // "Ativa" appears both in the status filter Select and in the badge
      const activeBadges = screen.getAllByText('Ativa');
      expect(activeBadges.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Inativa')).toBeInTheDocument();
    });

    it('shows description', async () => {
      await renderPage();
      expect(screen.getByText('Onboarding emails')).toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: mockAutomations,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('opens confirm dialog and triggers delete', async () => {
      await renderPage();

      const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /confirmar/i });
      fireEvent.click(confirmButton);

      expect(mockDeleteMutate).toHaveBeenCalledWith(1, expect.any(Object));
    });
  });

  describe('duplicate flow', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: mockAutomations,
        isLoading: false,
        isFetching: false,
        error: null,
      };
    });

    it('triggers duplicate on button click', async () => {
      await renderPage();

      const duplicateButtons = screen.getAllByRole('button', { name: /duplicar/i });
      fireEvent.click(duplicateButtons[0]);

      expect(mockDuplicateMutate).toHaveBeenCalledWith(1);
    });
  });
});
