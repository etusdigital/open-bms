// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BuilderProvider } from '../builder-context';
import { UserFieldStep } from '../user-field-step';
import type { BuilderCard, UserFieldStepData } from '../types';

function renderStep(stepData: Partial<UserFieldStepData> = {}) {
  const step: UserFieldStepData = {
    id: 'step-1',
    type: 'user_field',
    ...stepData,
  };
  const card: BuilderCard = { id: 'card-1', steps: [step] };
  return render(
    <TooltipProvider>
      <BuilderProvider initialCards={[card]}>
        <UserFieldStep data={step} cardId="card-1" />
      </BuilderProvider>
    </TooltipProvider>,
  );
}

describe('UserFieldStep', () => {
  it('renders field select', () => {
    renderStep();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1);
  });

  it('shows entry date filter when created_at_date selected', () => {
    renderStep({ user_field_key: 'created_at_date', conditional_user_field: '=' });
    // Should show operator and date input
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2);
  });

  it('shows last-N-days input when entry operator is "-"', () => {
    renderStep({
      user_field_key: 'created_at_date',
      conditional_user_field: '-',
      user_field_value: 7,
    });
    // Should show a number input for days
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows email provider options', () => {
    renderStep({
      user_field_key: 'email_provider',
      conditional_user_field: '=',
    });
    // Should have filter operator and value selects
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(3);
  });

  it('shows boolean yes/no for email deliverable', () => {
    renderStep({
      user_field_key: 'is_email_deliverable',
    });
    // Should show a yes/no select
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2);
  });

  it('does not show sub-filter when no field selected', () => {
    renderStep({ user_field_key: '' });
    // Only the field select should be visible
    expect(screen.getAllByRole('combobox').length).toBe(1);
  });
});
