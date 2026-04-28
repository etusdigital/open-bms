// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BuilderProvider } from '../builder-context';
import { AutomationStateStep } from '../automation-state-step';
import type { BuilderCard, AutomationStateStepData } from '../types';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: { results: [] } }) },
}));
vi.mock('@/stores/app-store', () => ({
  useAppStore: () => ({ status: 'authenticated', account: { id: 1 } }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function renderStep(stepData: Partial<AutomationStateStepData> = {}) {
  const step: AutomationStateStepData = {
    id: 'step-1',
    type: 'automation_state',
    event: 'entered',
    custom_times_value: 0,
    ...stepData,
  };
  const card: BuilderCard = { id: 'card-1', steps: [step] };
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BuilderProvider initialCards={[card]}>
          <AutomationStateStep data={step} cardId="card-1" />
        </BuilderProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('AutomationStateStep', () => {
  it('renders action, automation, operator, and times fields', () => {
    renderStep();
    // Should have multiple selects (action, automation, operator) and a number input
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(1);
  });

  it('renders period section', () => {
    renderStep({ time: 7 });
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(4);
  });

  it('shows custom days input when period is custom', () => {
    renderStep({ time: 'custom', time_custom: 30 });
    const inputs = screen.getAllByRole('spinbutton');
    const customDaysInput = inputs.find((input) => input.getAttribute('max') === '90');
    expect(customDaysInput).toBeTruthy();
  });
});
