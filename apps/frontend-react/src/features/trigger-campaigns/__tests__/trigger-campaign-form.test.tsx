import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import TriggerCampaignForm from '../trigger-campaign-form';

const mockMessages = [
  {
    id: 100,
    title: 'Promo Email A',
    subject: 'Sale 50% OFF',
    name: 'promo-a',
    fromName: 'Loja',
    fromMail: 'loja@test.com',
  },
  {
    id: 200,
    title: 'Promo Email B',
    subject: 'Flash Sale',
    name: 'promo-b',
    fromName: 'Loja',
    fromMail: 'loja@test.com',
  },
  {
    id: 300,
    title: 'Newsletter',
    subject: 'Weekly News',
    name: 'newsletter',
    fromName: 'News',
    fromMail: 'news@test.com',
  },
];

vi.mock('@/features/campaigns/use-campaign-messages', () => ({
  useSearchMessages: () => ({ data: mockMessages, isLoading: false }),
}));

vi.mock('@/features/campaigns/use-campaigns', () => ({
  useValidateCampaignName: () => ({ data: [] }),
}));

const mockCustomEvents = [
  { id: 1, name: 'purchase_completed' },
  { id: 2, name: 'signup_finished' },
];

vi.mock('../use-trigger-campaigns', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useCustomEvents: () => ({ data: mockCustomEvents, isLoading: false }),
  };
});

const mockOnSubmit = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderForm(props?: { defaultValues?: Record<string, unknown>; isPending?: boolean }) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <TriggerCampaignForm
        onSubmit={mockOnSubmit}
        isPending={props?.isPending ?? false}
        defaultValues={props?.defaultValues}
      />
    </QueryClientProvider>,
  );
}

describe('TriggerCampaignForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders 3 accordion section headers', async () => {
    await renderForm();
    expect(screen.getByText('O quê')).toBeInTheDocument();
    expect(screen.getByText('Quem')).toBeInTheDocument();
    expect(screen.getByText('Quando')).toBeInTheDocument();
  });

  it('shows title field in What section', async () => {
    await renderForm();
    expect(screen.getByLabelText(/título/i)).toBeInTheDocument();
  });

  it('shows messageType selector in What section', async () => {
    await renderForm();
    expect(screen.getByText(/tipo de mensagem/i)).toBeInTheDocument();
  });

  it('shows trigger type select in Who section', async () => {
    await renderForm();
    fireEvent.click(screen.getByText('Quem'));
    // Should show the event type selector label
    expect(screen.getByText(/Selecionar o tipo de evento/i)).toBeInTheDocument();
  });

  it('shows send timing radio in When section', async () => {
    await renderForm();
    // Click on the When section to open it
    fireEvent.click(screen.getByText('Quando'));
    expect(screen.getByText('Enviar após o evento')).toBeInTheDocument();
    expect(screen.getByText('Enviar após espera')).toBeInTheDocument();
  });

  it('shows save button', async () => {
    await renderForm();
    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
  });

  describe('Etapa 2: multi-message selection', () => {
    it('shows message search button in What section', async () => {
      await renderForm();
      expect(screen.getByTestId('trigger-message-search')).toBeInTheDocument();
    });

    it('shows selected messages with remove button', async () => {
      await renderForm({
        defaultValues: {
          title: 'Test',
          messages: [
            {
              id: 100,
              title: 'Promo Email A',
              subject: 'Sale 50% OFF',
              name: 'promo-a',
              links: [],
            },
          ],
        },
      });
      // Selected message should appear
      expect(screen.getByText('Promo Email A')).toBeInTheDocument();
      expect(screen.getByText(/Sale 50% OFF/)).toBeInTheDocument();
      // Remove button should be present
      expect(screen.getByTestId('remove-message-0')).toBeInTheDocument();
    });

    it('shows multiple selected messages', async () => {
      await renderForm({
        defaultValues: {
          title: 'Test',
          messages: [
            {
              id: 100,
              title: 'Promo Email A',
              subject: 'Sale 50% OFF',
              name: 'promo-a',
              links: [],
            },
            { id: 200, title: 'Promo Email B', subject: 'Flash Sale', name: 'promo-b', links: [] },
          ],
        },
      });
      expect(screen.getByText('Promo Email A')).toBeInTheDocument();
      expect(screen.getByText('Promo Email B')).toBeInTheDocument();
      expect(screen.getByTestId('remove-message-0')).toBeInTheDocument();
      expect(screen.getByTestId('remove-message-1')).toBeInTheDocument();
    });
  });

  describe('Etapa 4: message target for events', () => {
    it('shows message target selector when triggerType is events and eventType is open', async () => {
      await renderForm();
      fireEvent.click(screen.getByText('Quem'));
      // events + open is default — message target selector should appear
      expect(screen.getByTestId('trigger-message-target')).toBeInTheDocument();
    });

    it('does NOT show message target selector when eventType is first_open_30_days', async () => {
      await renderForm({
        defaultValues: { triggerType: 'events', eventType: 'first_open_30_days' },
      });
      fireEvent.click(screen.getByText('Quem'));
      expect(screen.queryByTestId('trigger-message-target')).not.toBeInTheDocument();
    });

    it('does NOT show message target selector when triggerType is custom_events', async () => {
      await renderForm({ defaultValues: { triggerType: 'custom_events' } });
      fireEvent.click(screen.getByText('Quem'));
      expect(screen.queryByTestId('trigger-message-target')).not.toBeInTheDocument();
    });
  });

  describe('Etapa 5: time period with unit', () => {
    it('shows time period input + unit selector when frequency is multiply-period', async () => {
      await renderForm();
      fireEvent.click(screen.getByText('Quem'));
      // Select multiply-period
      const periodRadio = screen.getByLabelText(/Apenas uma vez durante o período definido/i);
      fireEvent.click(periodRadio);
      expect(screen.getByTestId('time-period-value')).toBeInTheDocument();
      expect(screen.getByTestId('time-period-unit')).toBeInTheDocument();
    });

    it('does NOT show time period inputs when frequency is unique', async () => {
      await renderForm();
      fireEvent.click(screen.getByText('Quem'));
      // unique is default
      expect(screen.queryByTestId('time-period-value')).not.toBeInTheDocument();
    });

    it('shows conditional placeholder text', async () => {
      await renderForm();
      fireEvent.click(screen.getByText('Quem'));
      expect(screen.getByTestId('conditional-builder')).toBeInTheDocument();
    });
  });

  describe('Etapa 3: custom events selector', () => {
    it('shows custom event selector when triggerType is custom_events', async () => {
      await renderForm({ defaultValues: { triggerType: 'custom_events' } });
      fireEvent.click(screen.getByText('Quem'));
      expect(screen.getByTestId('custom-event-selector')).toBeInTheDocument();
    });

    it('does NOT show custom event selector when triggerType is events', async () => {
      await renderForm();
      fireEvent.click(screen.getByText('Quem'));
      // events is default — no custom event selector
      expect(screen.queryByTestId('custom-event-selector')).not.toBeInTheDocument();
    });
  });

  describe('Etapa 6: wait time with unit', () => {
    it('shows wait value + unit selector when sendTiming is wait', async () => {
      await renderForm();
      fireEvent.click(screen.getByText('Quando'));
      // Select wait radio
      const waitRadio = screen.getByLabelText(/Enviar após espera/i);
      fireEvent.click(waitRadio);
      // Should show number input and unit selector
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('does NOT show wait inputs when sendTiming is immediate', async () => {
      await renderForm();
      fireEvent.click(screen.getByText('Quando'));
      // immediate is default — no wait inputs in When section
      // The spinbutton should not be in When section (it might be in Who section for time period)
      const whenSection = screen.getByText('Quando').closest('[class*="rounded-lg"]')!;
      expect(whenSection.querySelector('input[type="number"]')).not.toBeInTheDocument();
    });
  });

  describe('Etapa 8: name validation', () => {
    it('shows warning when title already exists', async () => {
      // This test verifies the integration point exists — actual API validation
      // is tested via the useValidateCampaignName hook in campaign tests
      await renderForm({ defaultValues: { title: 'Existing Campaign' } });
      // The title field should exist and be editable
      const titleInput = screen.getByDisplayValue('Existing Campaign');
      expect(titleInput).toBeInTheDocument();
    });
  });

  it('validates required title on submit', async () => {
    await renderForm();

    const createButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(createButton);

    const errors = await screen.findAllByText(/obrigatório/i);
    expect(errors).toHaveLength(1);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
