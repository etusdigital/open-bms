// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BuilderProvider } from '../builder-context';
import { CustomFieldStep } from '../custom-field-step';
import type { BuilderCard, CustomFieldStepData } from '../types';

// Mock API client and app store
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: { results: [] } }) },
}));
vi.mock('@/stores/app-store', () => ({
  useAppStore: () => ({ status: 'authenticated', account: { id: 1 } }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function renderStep(stepData: Partial<CustomFieldStepData> = {}) {
  const step: CustomFieldStepData = {
    id: 'step-1',
    type: 'custom_field',
    ...stepData,
  };
  const card: BuilderCard = { id: 'card-1', steps: [step] };
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BuilderProvider initialCards={[card]}>
          <CustomFieldStep data={step} cardId="card-1" />
        </BuilderProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('CustomFieldStep', () => {
  it('renders field select', () => {
    renderStep();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1);
  });

  it('shows operator and value when field is selected', () => {
    renderStep({
      custom_field_id: 1,
      custom_field_name: 'Score',
      custom_field_type: 'number',
    });
    // Should have multiple selects (field + operator) and an input
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(1);
  });

  it('shows text input for text fields', () => {
    renderStep({
      custom_field_id: 1,
      custom_field_name: 'Name',
      custom_field_type: 'text',
      custom_field_value: 'test',
    });
    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
  });

  it('shows date picker for date fields', () => {
    renderStep({
      custom_field_id: 1,
      custom_field_name: 'Birthday',
      custom_field_type: 'date',
    });
    // DatePickerField renders a button with a calendar icon
    const dateButton = screen.getByRole('button', { name: /selecionar|select/i });
    expect(dateButton).toBeInTheDocument();
  });
});
