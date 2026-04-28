import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import TriggerCampaignFormPage from '../trigger-campaign-form-page';

let mockCampaignQuery: Record<string, unknown> = {};
const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();

vi.mock('../use-trigger-campaigns', () => ({
  useTriggerCampaign: () => mockCampaignQuery,
  useCreateTriggerCampaign: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateTriggerCampaign: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useTriggerCampaignsList: () => ({}),
  useDeleteTriggerCampaign: () => ({}),
}));

vi.mock('@/features/campaigns/use-campaign-messages', () => ({
  useSearchMessages: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/features/campaigns/use-campaigns', () => ({
  useValidateCampaignName: () => ({ data: [] }),
  useCampaignDashboardStats: () => ({ data: null, isSuccess: false }),
}));

describe('TriggerCampaignFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockCampaignQuery = {};
  });

  it('shows loading skeleton in edit mode', async () => {
    mockCampaignQuery = { data: undefined, isLoading: true };
    await renderWithRouter(<TriggerCampaignFormPage campaignId={1} />);
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders form in create mode', async () => {
    await renderWithRouter(<TriggerCampaignFormPage />);
    expect(screen.getByText(/criar trigger campaign/i)).toBeInTheDocument();
  });

  it('shows form with data in edit mode', async () => {
    mockCampaignQuery = {
      data: {
        id: 1,
        title: 'Test Campaign',
        description: 'A test',
        messageType: 'email',
        type: 'simple',
        status: 0,
        sendToAll: false,
        isTrigger: true,
      },
      isLoading: false,
      isError: false,
    };
    await renderWithRouter(<TriggerCampaignFormPage campaignId={1} />);
    expect(screen.getByText(/editar trigger campaign/i)).toBeInTheDocument();
  });

  it('shows not found for invalid campaign', async () => {
    mockCampaignQuery = { data: null, isLoading: false, isError: true };
    await renderWithRouter(<TriggerCampaignFormPage campaignId={999} />);
    expect(screen.getByText(/não foi encontrado/i)).toBeInTheDocument();
  });
});
