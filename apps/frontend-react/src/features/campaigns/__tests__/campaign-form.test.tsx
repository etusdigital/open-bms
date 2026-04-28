// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import CampaignForm from '../campaign-form';

// Mock hooks used by step components
vi.mock('../use-campaign-tags', () => ({
  useTagsForAudience: () => ({ data: [], isLoading: false }),
}));

vi.mock('../use-campaign-messages', () => ({
  useSearchMessages: () => ({ data: [], isLoading: false }),
}));

vi.mock('../use-campaign-labels', () => ({
  useLabelsForCampaign: () => ({
    data: [
      { value: 1, label: 'Label A' },
      { value: 2, label: 'Label B' },
      { value: 3, label: 'Label C' },
    ],
    isLoading: false,
  }),
}));

let mockValidateNameResult: any = { data: true };

vi.mock('../use-campaigns', () => ({
  useCountContacts: () => ({ mutate: vi.fn(), isPending: false, data: undefined }),
  useValidateCampaignName: () => mockValidateNameResult,
  useCampaignsList: () => ({}),
  useCampaign: () => ({}),
  useCreateCampaign: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCampaign: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCampaign: () => ({}),
  useDuplicateCampaign: () => ({}),
}));

const mockOnSubmit = vi.fn();
const mockOnCancel = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

async function renderForm(props?: { defaultValues?: Record<string, unknown>; isInternal?: boolean }) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <CampaignForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isPending={false}
        isInternal={props?.isInternal}
        defaultValues={props?.defaultValues as any}
      />
    </QueryClientProvider>,
  );
}

describe('CampaignForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockValidateNameResult = { data: true };
  });

  it('renders step indicator with 5 steps', async () => {
    await renderForm();
    const indicator = screen.getByTestId('step-indicator');
    expect(indicator).toBeInTheDocument();
    expect(screen.getAllByText('Geral').length).toBeGreaterThan(0);
    expect(screen.getByText('Audiência')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
    expect(screen.getByText('Agendamento')).toBeInTheDocument();
    expect(screen.getByText('Revisão')).toBeInTheDocument();
  });

  it('shows settings fields on first step', async () => {
    await renderForm();
    expect(screen.getByTestId('campaign-title')).toBeInTheDocument();
    expect(screen.getByTestId('channel-cards')).toBeInTheDocument();
    expect(screen.getByTestId('type-cards')).toBeInTheDocument();
  });

  it('next button advances to step 2', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Test Campaign' },
    });

    const nextButton = screen.getByRole('button', { name: /próximo/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByTestId('audience-step')).toBeInTheDocument();
    });
  });

  it('previous button goes back to step 1', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Test Campaign' },
    });
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));

    await waitFor(() => {
      expect(screen.getByTestId('audience-step')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /anterior/i }));

    await waitFor(() => {
      expect(screen.getByTestId('campaign-title')).toBeInTheDocument();
    });
  });

  it('previous button is hidden on step 0', async () => {
    await renderForm();
    expect(screen.queryByRole('button', { name: /anterior/i })).not.toBeInTheDocument();
  });

  it('shows audience options on step 2', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Test Campaign' },
    });
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));

    await waitFor(() => {
      expect(screen.getByTestId('audience-step')).toBeInTheDocument();
    });
  });

  it('shows schedule step on step 4', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Test' },
    });

    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
      await waitFor(() => {
        expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('schedule-step')).toBeInTheDocument();
    });
  });

  it('shows review summary on step 5', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'My Campaign' },
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
  });

  it('submit button appears on last step', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'My Campaign' },
    });

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
      await waitFor(() => {
        expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
      });
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /próximo/i })).not.toBeInTheDocument();
  });

  it('cancel button is always visible and calls onCancel', async () => {
    await renderForm();
    const cancelButton = screen.getByTestId('cancel-button');
    expect(cancelButton).toBeInTheDocument();
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('Save & Exit button is visible on all steps for new campaigns', async () => {
    await renderForm();
    expect(screen.getByTestId('save-and-exit')).toBeInTheDocument();

    // Advance to step 2 and check it's still there
    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));

    await waitFor(() => {
      expect(screen.getByTestId('audience-step')).toBeInTheDocument();
    });
    expect(screen.getByTestId('save-and-exit')).toBeInTheDocument();
  });

  it('Save & Exit triggers onSubmit with Draft status', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('campaign-title'), {
      target: { value: 'Draft Campaign' },
    });

    fireEvent.click(screen.getByTestId('save-and-exit'));

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: 0 }));
  });

  it('renders campaign type descriptions', async () => {
    await renderForm();
    expect(screen.getByText(/Crie uma campanha com envio único/)).toBeInTheDocument();
    expect(screen.getByText(/Teste mais de uma mensagem/)).toBeInTheDocument();
  });

  it('shows "Nome" as field label (not "Título")', async () => {
    await renderForm();
    expect(screen.getByText('Nome')).toBeInTheDocument();
  });

  it('shows "Detalhes" section header', async () => {
    await renderForm();
    expect(screen.getByText('Detalhes')).toBeInTheDocument();
  });

  describe('Etapa 1: form submission guard and status', () => {
    async function advanceToScheduleStep() {
      await renderForm();
      fireEvent.change(screen.getByTestId('campaign-title'), {
        target: { value: 'Test Campaign' },
      });
      // Advance through steps 0→1→2→3 (schedule)
      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
        await waitFor(() => {
          expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
        });
      }
      await waitFor(() => {
        expect(screen.getByTestId('schedule-step')).toBeInTheDocument();
      });
    }

    async function advanceToReviewStep() {
      await renderForm();
      fireEvent.change(screen.getByTestId('campaign-title'), {
        target: { value: 'My Campaign' },
      });
      // Advance through all 4 steps to reach review (step 4)
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
        await waitFor(() => {
          expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
        });
      }
      await waitFor(() => {
        expect(screen.getByTestId('review-step')).toBeInTheDocument();
      });
    }

    it('pressing Enter on schedule step does NOT trigger form submission', async () => {
      await advanceToScheduleStep();

      // Simulate form submit event (equivalent to pressing Enter in an input)
      const form = screen.getByTestId('schedule-step').closest('form')!;
      fireEvent.submit(form);

      // Should NOT call onSubmit — we're not on the last step
      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('submitting on the review step sets status to Scheduled (1)', async () => {
      await advanceToReviewStep();

      const submitButton = screen.getByRole('button', { name: /criar/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: 1 }));
    });

    it('pressing Enter on settings step does NOT trigger form submission', async () => {
      await renderForm();
      fireEvent.change(screen.getByTestId('campaign-title'), {
        target: { value: 'Test Campaign' },
      });

      // Simulate form submit event on step 0
      const form = screen.getByTestId('campaign-title').closest('form')!;
      fireEvent.submit(form);

      // Should NOT call onSubmit — we're on step 0, not the last step
      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('clicking Next on schedule step (simple campaign) advances to review WITHOUT calling onSubmit', async () => {
      await advanceToScheduleStep();

      // At this point we're on the schedule step for a "simple" campaign
      // Clicking "Next" should advance to review, not trigger API call
      const nextButton = screen.getByRole('button', { name: /próximo/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByTestId('review-step')).toBeInTheDocument();
      });

      // Must NOT have called onSubmit — this is the critical bug assertion
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Etapa 3: type and channel change side effects', () => {
    it('sets spreadSending to 0 when messageType changes to web-push', async () => {
      // Need accountConfigs with web-push active for the channel to be clickable
      authenticateStore({
        accountConfigs: [
          {
            accountId: 10,
            name: 'email_settings',
            value: '{"isActive":true}',
            isLoadConfig: false,
          },
          {
            accountId: 10,
            name: 'webpush_settings',
            value: '{"isActive":true}',
            isLoadConfig: false,
          },
        ],
      });
      await renderForm();

      // Default spreadSending is 60. Change channel to web-push.
      fireEvent.click(screen.getByTestId('channel-web-push'));

      // Use Save Draft to inspect the payload — it captures form state directly
      fireEvent.change(screen.getByTestId('campaign-title'), {
        target: { value: 'Test' },
      });
      fireEvent.click(screen.getByTestId('save-and-exit'));

      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({ spreadSending: 0 }));
    });

    it('initializes testAB fields when type changes to testAB', async () => {
      authenticateStore({
        accountConfigs: [
          {
            accountId: 10,
            name: 'email_settings',
            value: '{"isActive":true}',
            isLoadConfig: false,
          },
        ],
      });
      await renderForm();

      // Select testAB type (only visible for email channel which is default)
      fireEvent.click(screen.getByTestId('type-testAB'));

      // Advance to schedule step to verify TestAB section appears
      fireEvent.change(screen.getByTestId('campaign-title'), {
        target: { value: 'Test AB Campaign' },
      });
      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
        await waitFor(() => {
          expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('schedule-step')).toBeInTheDocument();
      });

      // TestAB section should be visible with initialized values
      expect(screen.getByTestId('testab-section')).toBeInTheDocument();
      expect(screen.getByTestId('criteria-open')).toBeInTheDocument();
    });

    it('resets type to simple when messageType changes from email to sms with testAB selected', async () => {
      authenticateStore({
        accountConfigs: [
          {
            accountId: 10,
            name: 'email_settings',
            value: '{"isActive":true}',
            isLoadConfig: false,
          },
          { accountId: 10, name: 'sms_settings', value: '{"isActive":true}', isLoadConfig: false },
        ],
      });
      await renderForm();

      // Select testAB type (email channel)
      fireEvent.click(screen.getByTestId('type-testAB'));

      // Change channel to SMS — testAB should reset to simple
      fireEvent.click(screen.getByTestId('channel-sms'));

      await waitFor(() => {
        // testAB option should no longer be visible (email-only)
        expect(screen.queryByTestId('type-testAB')).not.toBeInTheDocument();
        // simple should be selected
        expect(screen.getByTestId('type-simple')).toBeInTheDocument();
      });
    });
  });

  describe('Etapa 6: name validation warning', () => {
    it('shows warning when campaign title already exists', async () => {
      // Simulate API returning that the name is taken
      mockValidateNameResult = { data: [{ id: 1, title: 'Existing' }] };
      await renderForm();

      fireEvent.change(screen.getByTestId('campaign-title'), {
        target: { value: 'Existing Campaign' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('title-not-available')).toBeInTheDocument();
      });
    });

    it('hides warning when campaign title is available', async () => {
      mockValidateNameResult = { data: [] };
      await renderForm();

      fireEvent.change(screen.getByTestId('campaign-title'), {
        target: { value: 'New Campaign' },
      });

      await waitFor(() => {
        expect(screen.queryByTestId('title-not-available')).not.toBeInTheDocument();
      });
    });
  });

  describe('Etapa 4: duplicate message validation', () => {
    it('blocks submission when testAB campaign has duplicate messages', async () => {
      // Use Save Draft to bypass Zod validation — it calls onSubmit directly
      // This isolates the duplicate check from schema validation
      await renderForm({
        defaultValues: {
          title: 'TestAB Dup',
          type: 'testAB' as const,
          messageType: 'email' as const,
          campaignMessage: [
            { id: 100, title: 'Msg A', messageId: 100 },
            { id: 100, title: 'Msg A', messageId: 100 },
          ],
        },
      });

      // Advance to review step (step 4)
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
        await waitFor(() => {
          expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('review-step')).toBeInTheDocument();
      });

      // Click submit button — handleFormSubmit should block due to duplicate messages
      fireEvent.click(screen.getByRole('button', { name: /salvar|criar/i }));

      // Wait a tick then verify onSubmit was NOT called
      await new Promise((r) => setTimeout(r, 100));
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('allows submission when testAB campaign has distinct messages', async () => {
      await renderForm({
        defaultValues: {
          title: 'TestAB OK',
          type: 'testAB' as const,
          messageType: 'email' as const,
          campaignMessage: [
            { id: 100, title: 'Msg A', messageId: 100 },
            { id: 200, title: 'Msg B', messageId: 200 },
          ],
        },
      });

      // Advance to review step
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
        await waitFor(() => {
          expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('review-step')).toBeInTheDocument();
      });

      // Click submit — should succeed
      fireEvent.click(screen.getByRole('button', { name: /salvar|criar/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });
});
