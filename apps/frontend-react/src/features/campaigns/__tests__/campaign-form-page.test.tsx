// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import CampaignFormPage from '../campaign-form-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockNavigate = vi.fn();

let mockCampaignQuery: Record<string, unknown> = {};

vi.mock('../use-campaigns', () => ({
  useCampaign: () => mockCampaignQuery,
  useCreateCampaign: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateCampaign: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useCampaignsList: () => ({}),
  useDeleteCampaign: () => ({}),
  useDuplicateCampaign: () => ({}),
  useCountContacts: () => ({ mutate: vi.fn(), isPending: false, data: undefined }),
  useValidateCampaignName: () => ({ data: [] }),
}));

vi.mock('../use-campaign-tags', () => ({
  useTagsForAudience: () => ({ data: [], isLoading: false }),
}));

vi.mock('../use-campaign-messages', () => ({
  useSearchMessages: () => ({ data: [], isLoading: false }),
}));

vi.mock('../use-campaign-labels', () => ({
  useLabelsForCampaign: () => ({ data: [], isLoading: false }),
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

// EVO-1410: the campaign form gates steps by active account channels, so the
// email channel must be enabled for the wizard to advance past step 0.
const emailEnabled = [{ accountId: 10, name: 'email_settings', value: '{"isActive":true}', isLoadConfig: false }];

async function renderFormPage(campaignId?: number) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <CampaignFormPage campaignId={campaignId} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CampaignFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore({ accountConfigs: emailEnabled });
    mockCampaignQuery = {
      data: undefined,
      isLoading: false,
      error: null,
    };
  });

  it('shows loading skeleton in edit mode', async () => {
    mockCampaignQuery = {
      data: undefined,
      isLoading: true,
      error: null,
    };
    await renderFormPage(5);
    expect(screen.getByText(/editar/i)).toBeInTheDocument();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders form in create mode', async () => {
    await renderFormPage();
    expect(screen.getByText(/criar campanha/i)).toBeInTheDocument();
    expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
  });

  it('shows form with data in edit mode', async () => {
    mockCampaignQuery = {
      data: {
        id: 5,
        title: 'Existing Campaign',
        description: 'Campaign description',
        type: 'simple',
        messageType: 'email',
        sendToAll: true,
        scheduleTo: '',
      },
      isLoading: false,
      error: null,
    };
    await renderFormPage(5);
    expect(screen.getByText(/editar/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Campaign')).toBeInTheDocument();
  });

  it('shows not found for invalid campaign', async () => {
    mockCampaignQuery = {
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    };
    await renderFormPage(999);
    expect(screen.getByText(/não foi encontrado/i)).toBeInTheDocument();
  });

  it('passes isSuperAdmin to CampaignForm when effectiveRole is super_admin', async () => {
    authenticateStore({ effectiveRole: 'super_admin', accountConfigs: emailEnabled });
    await renderFormPage();

    // Advance to audience step to check if "Run Segment" toggle is visible
    const { fireEvent, waitFor } = await import('@testing-library/react');
    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Test Campaign' },
    });
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));

    await waitFor(() => {
      expect(screen.getByTestId('audience-step')).toBeInTheDocument();
    });

    // Run Segment toggle should be visible for super admins
    expect(screen.getByTestId('run-segment-toggle')).toBeInTheDocument();
  });

  it('hides Run Segment toggle when user is not super admin', async () => {
    authenticateStore({ effectiveRole: 'user', accountConfigs: emailEnabled });
    await renderFormPage();

    const { fireEvent, waitFor } = await import('@testing-library/react');
    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Test Campaign' },
    });
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));

    await waitFor(() => {
      expect(screen.getByTestId('audience-step')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('run-segment-toggle')).not.toBeInTheDocument();
  });

  describe('Etapa 5: 409 conflict handling', () => {
    it('does not navigate on 409 error and calls mutation only once', async () => {
      mockCreateMutate.mockImplementation((_data: any, opts: any) => {
        const error = {
          response: {
            status: 409,
            data: { statusCode: 409 },
          },
        };
        opts?.onError?.(error);
      });

      await renderFormPage();

      fireEvent.change(screen.getByTestId('campaign-title'), {
        target: { value: 'Conflicting Campaign' },
      });
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
        await waitFor(() => {
          expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
        });
      }
      await waitFor(() => {
        expect(screen.getByTestId('review-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /criar/i }));

      await waitFor(() => {
        expect(mockCreateMutate).toHaveBeenCalledTimes(1);
      });

      // Should NOT navigate — the error blocks it
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
