// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import AudienceStep from '../steps/audience-step';
import type { CampaignFormValues } from '../campaign-schema';

vi.mock('../use-campaign-tags', () => ({
  useTagsForAudience: () => ({
    data: [
      { value: '1', label: 'Tag A (100)', id: 1, name: 'Tag A', count: 100, type: 'tag' },
      { value: '2', label: 'Tag B (200)', id: 2, name: 'Tag B', count: 200, type: 'tag' },
      { value: '3', label: 'Tag C (50)', id: 3, name: 'Tag C', count: 50, type: 'tag' },
    ],
    isLoading: false,
  }),
}));

vi.mock('../use-campaigns', () => ({
  useCountContacts: () => ({ mutate: vi.fn(), isPending: false, data: undefined }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function FormWrapper({
  defaultValues,
  children,
}: {
  defaultValues?: Partial<CampaignFormValues>;
  children: (form: ReturnType<typeof useForm<CampaignFormValues>>) => React.ReactNode;
}) {
  const form = useForm<CampaignFormValues>({
    defaultValues: {
      sendToAll: false,
      messageType: 'email',
      steps: [],
      ...defaultValues,
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <FormProvider {...form}>{children(form)}</FormProvider>
    </QueryClientProvider>
  );
}

async function renderAudienceStep(defaultValues?: Partial<CampaignFormValues>) {
  return renderWithRouter(
    <FormWrapper defaultValues={defaultValues}>{(form) => <AudienceStep form={form as any} />}</FormWrapper>,
  );
}

describe('AudienceStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('initializes with one empty card', async () => {
    await renderAudienceStep();

    await waitFor(() => {
      expect(screen.getByTestId('audience-card-0')).toBeInTheDocument();
    });
  });

  it('renders an "Add group" button', async () => {
    await renderAudienceStep();

    await waitFor(() => {
      expect(screen.getByTestId('audience-add-card')).toBeInTheDocument();
    });
  });

  it('adds a second card when clicking "Add group"', async () => {
    await renderAudienceStep();

    await waitFor(() => {
      expect(screen.getByTestId('audience-card-0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('audience-add-card'));

    await waitFor(() => {
      expect(screen.getByTestId('audience-card-1')).toBeInTheDocument();
    });

    // Card-level conditional should appear between cards
    expect(screen.getByTestId('audience-conditional')).toBeInTheDocument();
  });

  it('removes a card', async () => {
    await renderAudienceStep();

    await waitFor(() => {
      expect(screen.getByTestId('audience-card-0')).toBeInTheDocument();
    });

    // Add second card
    fireEvent.click(screen.getByTestId('audience-add-card'));
    await waitFor(() => {
      expect(screen.getByTestId('audience-card-1')).toBeInTheDocument();
    });

    // Remove second card
    fireEvent.click(screen.getByTestId('audience-remove-1'));

    await waitFor(() => {
      expect(screen.queryByTestId('audience-card-1')).not.toBeInTheDocument();
    });
  });

  it('duplicates a card', async () => {
    await renderAudienceStep();

    await waitFor(() => {
      expect(screen.getByTestId('audience-card-0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('audience-duplicate-0'));

    await waitFor(() => {
      expect(screen.getByTestId('audience-card-1')).toBeInTheDocument();
    });
  });

  it('renders "Add condition" button within cards', async () => {
    await renderAudienceStep();

    await waitFor(() => {
      expect(screen.getByTestId('audience-add-step-0')).toBeInTheDocument();
    });
  });

  it('adds a tag row within a card when clicking "Add condition"', async () => {
    await renderAudienceStep();

    await waitFor(() => {
      expect(screen.getByTestId('audience-card-0')).toBeInTheDocument();
    });

    // Initially one tag row
    const initialRows = screen.getAllByTestId('audience-tag-row');
    expect(initialRows).toHaveLength(1);

    fireEvent.click(screen.getByTestId('audience-add-step-0'));

    await waitFor(() => {
      const rows = screen.getAllByTestId('audience-tag-row');
      expect(rows).toHaveLength(2);
    });

    // Step-level conditional should appear between rows
    expect(screen.getByTestId('audience-conditional-step')).toBeInTheDocument();
  });

  it('shows sendToAll toggle for non-email channels', async () => {
    await renderAudienceStep({ messageType: 'sms' });

    await waitFor(() => {
      expect(screen.getByTestId('send-to-radio')).toBeInTheDocument();
    });
  });

  it('hides cards when sendToAll is true', async () => {
    await renderAudienceStep({ sendToAll: true, messageType: 'sms' });

    expect(screen.queryByTestId('audience-card-0')).not.toBeInTheDocument();
  });

  it('renders with pre-populated steps in nested format', async () => {
    await renderAudienceStep({
      steps: [
        [
          {
            type: 'tag',
            conditional_tag: 'in',
            tag_id: [1, 2],
            tag_info: [
              { id: 1, name: 'Tag A' },
              { id: 2, name: 'Tag B' },
            ],
          },
          {
            type: 'tag',
            conditional: 'EXCEPT',
            conditional_tag: 'not in',
            tag_id: [3],
            tag_info: [{ id: 3, name: 'Tag C' }],
          },
        ],
        [
          { type: 'conditionalCard', value: 'UNION' },
          { type: 'tag', conditional_tag: 'in', tag_id: [1], tag_info: [{ id: 1, name: 'Tag A' }] },
        ],
      ] as any,
    });

    await waitFor(() => {
      expect(screen.getByTestId('audience-card-0')).toBeInTheDocument();
      expect(screen.getByTestId('audience-card-1')).toBeInTheDocument();
    });

    // Card 0 should have 2 tag rows
    const card0 = screen.getByTestId('audience-card-0');
    const tagRows = card0.querySelectorAll('[data-testid="audience-tag-row"]');
    expect(tagRows).toHaveLength(2);
  });
});
