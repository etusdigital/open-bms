import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import TriggerCampaignsPage from '../trigger-campaigns-page';
import type { PaginatedResponse } from '@/types';
import type { Campaign } from '@/features/campaigns/types';

let mockQueryReturn: Record<string, unknown> = {};
const mockDeleteMutate = vi.fn();

vi.mock('../use-trigger-campaigns', () => ({
  useTriggerCampaignsList: () => mockQueryReturn,
  useDeleteTriggerCampaign: () => ({ mutate: mockDeleteMutate, isPending: false }),
  useTriggerCampaignListStats: () => new Map(),
}));

function renderPage() {
  return renderWithRouter(
    <TriggerCampaignsPage searchParams={{ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }} />,
  );
}

const mockTriggerCampaigns: PaginatedResponse<Campaign> = {
  data: [
    {
      id: 1,
      title: 'Abandoned Cart',
      type: 'simple',
      messageType: 'email',
      status: 0,
      sendToAll: false,
      isTrigger: true,
      updatedAt: '2026-03-13T10:00:00Z',
      sentContacts: 120,
    },
    {
      id: 2,
      title: 'Welcome Flow',
      type: 'simple',
      messageType: 'sms',
      status: 0,
      sendToAll: false,
      isTrigger: true,
      updatedAt: '2026-03-12T10:00:00Z',
      sentContacts: 500,
    },
  ],
  meta: { total: 2, page: 1, lastPage: 1, itemsPerPage: 10 },
};

describe('TriggerCampaignsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore({ permissions: ['campaigns:view', 'campaigns:create', 'campaigns:delete'] });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockQueryReturn = { data: undefined, isLoading: true, error: null };
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Trigger Campaigns')).toBeInTheDocument();
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
      mockQueryReturn = {
        data: mockTriggerCampaigns,
        isLoading: false,
        isFetching: false,
        error: null,
      };
    });

    it('renders trigger campaign titles', async () => {
      await renderPage();
      expect(screen.getByText('Abandoned Cart')).toBeInTheDocument();
      expect(screen.getByText('Welcome Flow')).toBeInTheDocument();
    });

    it('shows create button with permission', async () => {
      await renderPage();
      expect(screen.getByText(/criar trigger campaign/i)).toBeInTheDocument();
    });

    it('hides create button without permission', async () => {
      authenticateStore({ permissions: ['campaigns:view'] });
      await renderPage();
      expect(screen.queryByText(/criar trigger campaign/i)).not.toBeInTheDocument();
    });

    it('renders message type column', async () => {
      await renderPage();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('SMS')).toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: mockTriggerCampaigns,
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
});
