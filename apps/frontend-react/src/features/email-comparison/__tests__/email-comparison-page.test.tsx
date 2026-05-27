import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import EmailComparisonPage from '../email-comparison-page';
import type { ComparisonSearchParams } from '../comparison-search-schema';

let mockComparisonReturn: Record<string, unknown> = {};
let mockMessagesReturn: Record<string, unknown> = {};

vi.mock('../use-email-comparison', () => ({
  useMessageComparison: () => mockComparisonReturn,
}));

vi.mock('../use-comparison-messages', () => ({
  useComparisonMessages: () => mockMessagesReturn,
}));

vi.mock('../use-resolve-messages', () => ({
  useResolveMessages: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/components/charts/echarts-base', () => ({
  EChartsBase: ({ height }: { height?: number }) => (
    <div data-testid="echarts-container" style={{ height: height ?? 350 }} />
  ),
}));

const defaultParams: ComparisonSearchParams = {
  type: 'email',
  messagesIds: '',
  metricType: 'delivered',
  displayMode: 'numeric',
  startDate: '2026-03-08',
  endDate: '2026-04-07',
};

function renderPage(params: Partial<ComparisonSearchParams> = {}) {
  return renderWithRouter(<EmailComparisonPage searchParams={{ ...defaultParams, ...params }} />);
}

describe('EmailComparisonPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockComparisonReturn = { data: undefined, isLoading: false, error: null };
    mockMessagesReturn = { data: [], isLoading: false };
  });

  it('renders the page title', async () => {
    await renderPage();
    expect(screen.getByText('Comparador de mensagens')).toBeInTheDocument();
  });

  it('renders tabs for E-mail and Web Push', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /E-mail/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Web Push/i })).toBeInTheDocument();
  });

  it('renders message selector', async () => {
    await renderPage();
    expect(screen.getByTestId('message-selector')).toBeInTheDocument();
  });

  it('renders metric selector', async () => {
    await renderPage();
    expect(screen.getByTestId('metric-selector')).toBeInTheDocument();
  });

  it('renders display mode toggle', async () => {
    await renderPage();
    expect(screen.getByTestId('display-mode-toggle')).toBeInTheDocument();
  });

  it('shows empty state when no messages selected', async () => {
    await renderPage();
    expect(screen.getByText('Selecione mensagens para iniciar a comparação.')).toBeInTheDocument();
  });
});
