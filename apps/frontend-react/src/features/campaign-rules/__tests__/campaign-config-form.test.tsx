import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { CampaignConfigForm } from '../campaign-config-form';

// Mock hooks used by step components
vi.mock('@/features/campaigns/use-campaign-tags', () => ({
  useTagsForAudience: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/features/campaigns/use-campaign-messages', () => ({
  useSearchMessages: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/features/campaigns/use-campaigns', () => ({
  useCountContacts: () => ({ mutate: vi.fn(), isPending: false, data: undefined }),
  useValidateCampaignName: () => ({ data: [] }),
}));

const mockSubmit = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

async function renderForm(defaultValues?: Parameters<typeof CampaignConfigForm>[0]['defaultValues']) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <CampaignConfigForm defaultValues={defaultValues} onSubmit={mockSubmit} isPending={false} />
    </QueryClientProvider>,
  );
}

describe('CampaignConfigForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders step indicator with 4 steps', async () => {
    await renderForm();
    const indicator = screen.getByTestId('step-indicator');
    expect(indicator).toBeInTheDocument();
    expect(screen.getByText('Audiência')).toBeInTheDocument();
    expect(screen.getByText('Agendamento')).toBeInTheDocument();
    expect(screen.getByText('Revisão')).toBeInTheDocument();
  });

  it('shows settings step on first step', async () => {
    await renderForm();
    expect(screen.getByTestId('campaign-title')).toBeInTheDocument();
    expect(screen.getByTestId('channel-cards')).toBeInTheDocument();
  });

  it('navigates to audience step on next', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Test Config' },
    });
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));

    await waitFor(() => {
      expect(screen.getByTestId('audience-step')).toBeInTheDocument();
    });
  });

  it('shows next button on non-last steps', async () => {
    await renderForm();
    expect(screen.getByRole('button', { name: /próximo/i })).toBeInTheDocument();
  });

  it('shows create button on last step for new config', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Test Config' },
    });

    // Navigate through all 4 steps to the last
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
      await waitFor(() => {
        expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
      });
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
    });
  });

  it('shows save button when editing', async () => {
    await renderForm({ name: 'Test', description: 'Desc' });

    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Test Config' },
    });

    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
      await waitFor(() => {
        expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
      });
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
    });
  });

  it('previous button is disabled on first step', async () => {
    await renderForm();
    const prevButton = screen.getByRole('button', { name: /anterior/i });
    expect(prevButton).toBeDisabled();
  });
});
