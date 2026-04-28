// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BuilderProvider } from '../builder-context';
import { TagStep } from '../tag-step';
import type { BuilderCard, TagStepData } from '../types';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: { results: [] } }) },
}));
vi.mock('@/stores/app-store', () => ({
  useAppStore: () => ({ status: 'authenticated', account: { id: 1 } }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function renderStep(stepData: Partial<TagStepData> = {}) {
  const step: TagStepData = {
    id: 'step-1',
    type: 'tag',
    conditional_tag: 'in',
    tag_id: [],
    tag_info: [],
    ...stepData,
  };
  const card: BuilderCard = { id: 'card-1', steps: [step] };
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BuilderProvider initialCards={[card]}>
          <TagStep data={step} cardId="card-1" />
        </BuilderProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('TagStep', () => {
  it('renders conditional select', () => {
    renderStep();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1);
  });

  it('displays tag badges when tags selected', () => {
    renderStep({
      tag_info: [
        { id: 1, name: 'VIP', lastCount: 500 },
        { id: 2, name: 'Active', lastCount: 1000 },
      ],
    });
    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows placeholder when no tags', () => {
    renderStep({ tag_info: [] });
    expect(screen.getByText(/selecionar/i)).toBeInTheDocument();
  });
});
