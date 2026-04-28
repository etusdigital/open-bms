// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BuilderProvider } from '../builder-context';
import { CustomEventStep } from '../custom-event-step';
import type { BuilderCard, CustomEventStepData } from '../types';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: { results: [] } }) },
}));
vi.mock('@/stores/app-store', () => ({
  useAppStore: () => ({ status: 'authenticated', account: { id: 1 } }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function renderStep(stepData: Partial<CustomEventStepData> = {}) {
  const step: CustomEventStepData = {
    id: 'step-1',
    type: 'custom_event',
    conditional_event_type: 'in',
    custom_times_value: 1,
    ...stepData,
  };
  const card: BuilderCard = { id: 'card-1', steps: [step] };
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BuilderProvider initialCards={[card]}>
          <CustomEventStep data={step} cardId="card-1" />
        </BuilderProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('CustomEventStep', () => {
  it('renders conditional and event fields', () => {
    renderStep();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2);
  });

  it('shows operator and times when conditional is "in"', () => {
    renderStep({ conditional_event_type: 'in' });
    // Should show operator + times
    expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(1);
  });

  it('hides operator and times when conditional is "not in"', () => {
    renderStep({ conditional_event_type: 'not in' });
    // Operator/times should not show
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('shows property filters when event is selected', () => {
    renderStep({
      event: { id: 1, name: 'Purchase' },
      properties: [{ property: 'amount', value: '100' }],
    });
    expect(screen.getByDisplayValue('amount')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('shows add property button when fewer than 3 properties', () => {
    renderStep({
      event: { id: 1, name: 'Purchase' },
      properties: [{ property: 'amount', value: '100' }],
    });
    // i18n key or fallback text
    expect(screen.getByText(/addProperty|adicionar propriedade/i)).toBeInTheDocument();
  });

  it('hides add property button when 3 properties exist', () => {
    renderStep({
      event: { id: 1, name: 'Purchase' },
      properties: [
        { property: 'a', value: '1' },
        { property: 'b', value: '2' },
        { property: 'c', value: '3' },
      ],
    });
    expect(screen.queryByText(/addProperty|adicionar propriedade/i)).not.toBeInTheDocument();
  });
});
