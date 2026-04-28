// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import AudienceTagRow from '../steps/audience-tag-row';
import type { AudienceStepItem } from '../types';

vi.mock('../use-campaign-tags', () => ({
  useTagsForAudience: () => ({
    data: [
      { value: '1', label: 'Tag A (100)', id: 1, name: 'Tag A', count: 100, type: 'tag' },
      { value: '2', label: 'Tag B (200)', id: 2, name: 'Tag B', count: 200, type: 'tag' },
    ],
    isLoading: false,
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderTagRow(props?: {
  step?: AudienceStepItem;
  onUpdate?: (updates: Partial<AudienceStepItem>) => void;
  onRemove?: () => void;
  canRemove?: boolean;
}) {
  const defaultStep: AudienceStepItem = {
    type: 'tag',
    conditional_tag: 'in',
    tag_id: [],
    tag_info: [],
  };

  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <AudienceTagRow
        step={props?.step ?? defaultStep}
        onUpdate={props?.onUpdate ?? vi.fn()}
        onRemove={props?.onRemove ?? vi.fn()}
        canRemove={props?.canRemove ?? false}
      />
    </QueryClientProvider>,
  );
}

describe('AudienceTagRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders with default conditional_tag "in"', async () => {
    await renderTagRow();

    const row = screen.getByTestId('audience-tag-row');
    expect(row).toBeInTheDocument();
    expect(screen.getByText('Tem')).toBeInTheDocument();
  });

  it('renders with conditional_tag "not in"', async () => {
    await renderTagRow({
      step: {
        type: 'tag',
        conditional_tag: 'not in',
        tag_id: [],
        tag_info: [],
      },
    });

    expect(screen.getByText('Não tem')).toBeInTheDocument();
  });

  it('shows remove button when canRemove is true', async () => {
    await renderTagRow({ canRemove: true });

    const row = screen.getByTestId('audience-tag-row');
    // Count buttons — with canRemove=true there should be 3: select trigger, combobox trigger, trash
    const buttons = row.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('hides remove button when canRemove is false', async () => {
    await renderTagRow({ canRemove: false });

    const row = screen.getByTestId('audience-tag-row');
    // With canRemove=false there should be 2: select trigger, combobox trigger
    const buttons = row.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });

  it('calls onRemove when trash button is clicked', async () => {
    const onRemove = vi.fn();
    await renderTagRow({ canRemove: true, onRemove });

    const row = screen.getByTestId('audience-tag-row');
    const buttons = row.querySelectorAll('button');
    // The trash button is the last button in the row
    const trashButton = buttons[buttons.length - 1];
    fireEvent.click(trashButton);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders selected tags from tag_info as badges', async () => {
    await renderTagRow({
      step: {
        type: 'tag',
        conditional_tag: 'in',
        tag_id: [1, 2],
        tag_info: [
          { id: 1, name: 'Tag A', count: 100, type: 'tag' },
          { id: 2, name: 'Tag B', count: 200, type: 'tag' },
        ],
      },
    });

    expect(screen.getByText('Tag A')).toBeInTheDocument();
    expect(screen.getByText('Tag B')).toBeInTheDocument();
  });

  it('shows placeholder text when no tags selected', async () => {
    await renderTagRow();

    expect(screen.getByText('Selecionar tags')).toBeInTheDocument();
  });
});
