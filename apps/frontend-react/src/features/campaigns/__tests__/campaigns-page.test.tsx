import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import CampaignsPage from '../campaigns-page';
import type { PaginatedResponse } from '@/types';
import type { Campaign } from '../types';
import { CampaignStatus } from '../types';

let mockQueryReturn: Record<string, unknown> = {};
const mockDeleteMutate = vi.fn();
const mockDuplicateMutate = vi.fn();

vi.mock('../use-campaigns', () => ({
  useCampaignsList: () => mockQueryReturn,
  useDeleteCampaign: () => ({ mutate: mockDeleteMutate, isPending: false }),
  useDuplicateCampaign: () => ({ mutate: mockDuplicateMutate, isPending: false }),
  useCampaignListStats: () => new Map(),
  useCampaignStatusCounts: () => ({
    data: { sending: 0, scheduled: 0, completed: 0 },
    isSuccess: true,
  }),
  useCampaignStatistics: () => ({ data: undefined }),
}));

vi.mock('@/features/contacts/use-contact-tags', () => ({
  useTagOptions: () => ({ data: [], isLoading: false }),
  useSegmentOptions: () => ({ data: [], isLoading: false }),
}));

function renderPage() {
  return renderWithRouter(
    <CampaignsPage
      searchParams={{
        page: 1,
        pageSize: 10,
        search: '',
        sort: '',
        order: 'asc',
        status: '',
        types: '',
        messages: '',
        tags: '',
        segments: '',
        startDate: '',
        endDate: '',
      }}
    />,
  );
}

const mockCampaigns: PaginatedResponse<Campaign> = {
  data: [
    {
      id: 1,
      title: 'Black Friday',
      type: 'simple',
      messageType: 'email',
      status: CampaignStatus.Draft,
      sendToAll: false,
      updatedAt: '2026-03-13T10:00:00Z',
    },
    {
      id: 2,
      title: 'Welcome Flow',
      type: 'testAB',
      messageType: 'email',
      status: CampaignStatus.Completed,
      sendToAll: false,
      updatedAt: '2026-03-12T10:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, itemsPerPage: 10, totalPages: 1 },
};

describe('CampaignsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockQueryReturn = { data: undefined, isLoading: true, isFetching: true, error: null };
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Campanhas')).toBeInTheDocument();
    });

    it('shows loading skeletons', async () => {
      await renderPage();
      const pulsingElements = document.querySelectorAll('.animate-pulse');
      expect(pulsingElements.length).toBeGreaterThan(0);
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: { data: [], meta: { total: 0, page: 1, itemsPerPage: 10, totalPages: 0 } },
        isLoading: false,
        isFetching: false,
        error: null,
      };
    });

    it('shows empty message', async () => {
      await renderPage();
      expect(screen.getByText(/nenhum.*campanha.*encontrad/i)).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockCampaigns, isLoading: false, isFetching: false, error: null };
    });

    it('renders campaign titles', async () => {
      await renderPage();
      expect(screen.getByText('Black Friday')).toBeInTheDocument();
      expect(screen.getByText('Welcome Flow')).toBeInTheDocument();
    });

    it('renders action menu triggers for each row', async () => {
      await renderPage();
      // Each row has a MoreVertical dropdown trigger (button with no text)
      const menuTriggers = screen.getAllByRole('button').filter((b) => !b.textContent?.trim());
      expect(menuTriggers.length).toBe(2); // one per campaign row
    });
  });
});
