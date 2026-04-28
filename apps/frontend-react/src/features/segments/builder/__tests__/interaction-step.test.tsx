// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BuilderProvider } from '../builder-context';
import { InteractionStep } from '../interaction-step';
import type { BuilderCard, InteractionStepData } from '../types';

// Mock the builder messages hook
vi.mock('../use-builder-messages', () => ({
  useBuilderMessages: () => ({ data: [], isLoading: false }),
}));

function renderStep(stepData: Partial<InteractionStepData> = {}) {
  const step: InteractionStepData = {
    id: 'step-1',
    type: 'interation',
    event_type: 'email',
    conditional_interation: 'yes',
    custom_times_value: 1,
    ...stepData,
  };

  const card: BuilderCard = { id: 'card-1', steps: [step] };

  return render(
    <TooltipProvider>
      <BuilderProvider initialCards={[card]}>
        <InteractionStep data={step} cardId="card-1" />
      </BuilderProvider>
    </TooltipProvider>,
  );
}

describe('InteractionStep', () => {
  it('renders with email channel type', () => {
    renderStep({ event_type: 'email' });
    // Should show the channel select and action fields
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1);
  });

  it('renders period section', () => {
    renderStep({ event_type: 'email', time: 7 });
    // Period section should be visible for non-anyChannel
    expect(screen.getAllByText(/período|period/i).length).toBeGreaterThanOrEqual(1);
  });

  it('hides action/message/operator for anyChannel', () => {
    renderStep({ event_type: 'anyChannel' });
    // Should NOT show action, message, operator labels
    expect(screen.queryByText(/ação|action/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mensagem|message/i)).not.toBeInTheDocument();
    // Should also not show period
    expect(screen.queryByText(/período|period/i)).not.toBeInTheDocument();
  });

  it('shows URL fields for page_view channel', () => {
    renderStep({ event_type: 'page_view' });
    // Should show URL input
    expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument();
  });

  it('hides operator/times for negation actions', () => {
    renderStep({
      event_type: 'email',
      event: 'noopen',
      conditional_interation: 'not',
    });
    // Times field label should not be present when negation
    expect(screen.queryByText(/vez\(es\)|time\(s\)/i)).not.toBeInTheDocument();
  });

  it('shows operator/times for positive actions', () => {
    renderStep({
      event_type: 'email',
      event: 'open',
      conditional_interation: 'yes',
    });
    // Should show times input
    const timesInputs = screen.getAllByRole('spinbutton');
    expect(timesInputs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows custom days input when period is custom', () => {
    renderStep({
      event_type: 'email',
      time: 'custom',
      time_custom: 30,
    });
    // Should show a number input with max constraint for custom days
    const inputs = screen.getAllByRole('spinbutton');
    const customDaysInput = inputs.find((input) => input.getAttribute('max') === '180');
    expect(customDaysInput).toBeTruthy();
  });
});
