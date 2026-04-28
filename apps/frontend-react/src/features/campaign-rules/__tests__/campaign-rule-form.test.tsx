import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { CampaignRuleForm } from '../campaign-rule-form';

// Mock the configs hook used by ConfigMultiSelect
vi.mock('../use-campaign-configs', () => ({
  useConfigsForSelect: () => ({ data: [], isLoading: false }),
  useCampaignConfigsList: () => ({}),
  useCampaignConfig: () => ({}),
  useCreateCampaignConfig: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCampaignConfig: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCampaignConfig: () => ({}),
  useDuplicateCampaignConfig: () => ({}),
}));

const mockSubmit = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

async function renderForm(defaultValues?: Parameters<typeof CampaignRuleForm>[0]['defaultValues']) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <CampaignRuleForm defaultValues={defaultValues} onSubmit={mockSubmit} isPending={false} />
    </QueryClientProvider>,
  );
}

describe('CampaignRuleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders name and description fields', async () => {
    await renderForm();
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument();
  });

  it('renders week day buttons', async () => {
    await renderForm();
    expect(screen.getByText('Seg')).toBeInTheDocument();
    expect(screen.getByText('Dom')).toBeInTheDocument();
  });

  it('renders config select button', async () => {
    await renderForm();
    expect(screen.getByTestId('config-select')).toBeInTheDocument();
  });

  it('shows create button when no default values', async () => {
    await renderForm();
    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
  });

  it('shows save button when editing', async () => {
    await renderForm({
      name: 'Test',
      description: 'Desc',
      weekDays: [1, 2],
      configIds: [],
    });
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });

  it('shows character counter for name', async () => {
    await renderForm();
    expect(screen.getByText('0/100')).toBeInTheDocument();
  });

  it('shows character counter for description', async () => {
    await renderForm();
    expect(screen.getByText('0/255')).toBeInTheDocument();
  });

  it('shows validation error when name is empty', async () => {
    await renderForm();
    const submitButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(screen.getAllByText(/obrigatório/i).length).toBeGreaterThan(0);
    });
  });

  it('disables submit button when isPending', async () => {
    await renderWithRouter(
      <QueryClientProvider client={queryClient}>
        <CampaignRuleForm onSubmit={mockSubmit} isPending={true} />
      </QueryClientProvider>,
    );
    const button = screen.getByRole('button', { name: /carregando/i });
    expect(button).toBeDisabled();
  });
});
