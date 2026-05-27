// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BuilderProvider } from '../builder-context';
import { ConditionBuilder } from '../condition-builder';
import type { BuilderCard, InteractionStepData } from '../types';

// Mock API dependencies used by step components
vi.mock('../use-builder-messages', () => ({
  useBuilderMessages: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: { results: [] } }) },
}));
vi.mock('@/stores/app-store', () => ({
  useAppStore: () => ({ status: 'authenticated', account: { id: 1 } }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function renderBuilder(initialCards: BuilderCard[] = []) {
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BuilderProvider initialCards={initialCards}>
          <ConditionBuilder />
        </BuilderProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function makeCard(overrides: Partial<BuilderCard> = {}): BuilderCard {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    steps: overrides.steps ?? [],
    cardConnector: overrides.cardConnector,
  };
}

function makeInteractionStep(overrides: Partial<InteractionStepData> = {}): InteractionStepData {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: 'interation',
    event_type: 'email',
    ...overrides,
  };
}

describe('ConditionBuilder', () => {
  it('renders empty state when no cards', () => {
    renderBuilder([]);
    expect(screen.getByText(/nenhuma condição/i)).toBeInTheDocument();
    expect(screen.getByText(/adicionar primeiro grupo/i)).toBeInTheDocument();
  });

  it('renders a card when cards exist', () => {
    const card = makeCard({ id: 'card-1', steps: [makeInteractionStep()] });
    renderBuilder([card]);

    expect(screen.queryByText(/nenhuma condição/i)).not.toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('adds a card when add button is clicked', () => {
    renderBuilder([]);

    fireEvent.click(screen.getByText(/adicionar primeiro grupo/i));

    expect(screen.queryByText(/nenhuma condição/i)).not.toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders multiple cards', () => {
    const card1 = makeCard({ id: 'card-1', steps: [makeInteractionStep()] });
    const card2 = makeCard({
      id: 'card-2',
      steps: [makeInteractionStep()],
      cardConnector: 'INTERSECT',
    });
    renderBuilder([card1, card2]);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows empty card state when card has no steps', () => {
    const card = makeCard({ id: 'card-1', steps: [] });
    renderBuilder([card]);

    expect(screen.getByText(/grupo vazio/i)).toBeInTheDocument();
  });

  it('renders step components for known step types', () => {
    const step1 = makeInteractionStep({ id: 'step-1' });
    const step2 = makeInteractionStep({ id: 'step-2', stepConnector: 'and' });
    const card = makeCard({ id: 'card-1', steps: [step1, step2] });
    renderBuilder([card]);

    // Real step components render with select fields (comboboxes)
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });
});
