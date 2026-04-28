// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';

let mockWarmupReturn: Record<string, unknown> = {};
let mockStatsReturn: Record<string, unknown> = {};

vi.mock('../use-warmups', () => ({
  useWarmup: () => mockWarmupReturn,
}));

vi.mock('../use-warmup-statistics', () => ({
  useWarmupStatistics: () => mockStatsReturn,
}));

vi.mock('@/components/charts/echarts-base', () => ({
  EChartsBase: ({ height }: { height: number }) => <div data-testid="echarts-container" style={{ height }} />,
}));

import { WarmupStatsPage } from '../warmup-stats-page';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const mockWarmup = {
  id: 7,
  accountId: 1,
  targetAccountId: 99,
  sender: 'test@warmup.com',
  ippool: 'pool-1',
  target: 100000,
  type: 'external',
  campaignId: 42,
  currentSend: 50000,
  createdAt: '2026-03-01T00:00:00Z',
};

const mockStats = {
  general: { delivered: 1000, open: 500, click: 100, bounce: 50, unsubscribe: 10, sent: 1100 },
  daily: [
    {
      date: '2026-04-01',
      delivered: 500,
      open: 250,
      click: 50,
      bounce: 25,
      unsubscribe: 5,
      sent: 550,
    },
    {
      date: '2026-04-02',
      delivered: 500,
      open: 250,
      click: 50,
      bounce: 25,
      unsubscribe: 5,
      sent: 550,
    },
  ],
};

async function renderPage() {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <WarmupStatsPage warmupId={7} />
    </QueryClientProvider>,
  );
}

describe('WarmupStatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('shows loading skeleton while fetching warmup', async () => {
    mockWarmupReturn = { data: undefined, isLoading: true };
    mockStatsReturn = { data: undefined, isLoading: true };
    await renderPage();
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders sender email in subtitle', async () => {
    mockWarmupReturn = { data: mockWarmup, isLoading: false };
    mockStatsReturn = { data: mockStats, isLoading: false };
    await renderPage();
    expect(screen.getByText(/test@warmup\.com/)).toBeInTheDocument();
  });

  it('renders delivered total in metric card', async () => {
    mockWarmupReturn = { data: mockWarmup, isLoading: false };
    mockStatsReturn = { data: mockStats, isLoading: false };
    await renderPage();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('renders open percentage', async () => {
    mockWarmupReturn = { data: mockWarmup, isLoading: false };
    mockStatsReturn = { data: mockStats, isLoading: false };
    await renderPage();
    // open=500, delivered=1000 → 50.00% (appears in card + table)
    const openPercentages = screen.getAllByText('50.00%');
    expect(openPercentages.length).toBeGreaterThanOrEqual(1);
  });

  it('renders progress bar with percentage', async () => {
    mockWarmupReturn = { data: mockWarmup, isLoading: false };
    mockStatsReturn = { data: mockStats, isLoading: false };
    await renderPage();
    // currentSend=50000, target=100000 → 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders chart toggle buttons', async () => {
    mockWarmupReturn = { data: mockWarmup, isLoading: false };
    mockStatsReturn = { data: mockStats, isLoading: false };
    await renderPage();
    const buttons = screen.getAllByRole('button');
    // At least 2 toggle buttons (# and %)
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders ECharts container', async () => {
    mockWarmupReturn = { data: mockWarmup, isLoading: false };
    mockStatsReturn = { data: mockStats, isLoading: false };
    await renderPage();
    expect(screen.getByTestId('echarts-container')).toBeInTheDocument();
  });

  it('renders daily data table rows', async () => {
    mockWarmupReturn = { data: mockWarmup, isLoading: false };
    mockStatsReturn = { data: mockStats, isLoading: false };
    await renderPage();
    // header + 2 data rows
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('shows no statistics message when daily data is empty', async () => {
    mockWarmupReturn = { data: mockWarmup, isLoading: false };
    mockStatsReturn = { data: { general: mockStats.general, daily: [] }, isLoading: false };
    await renderPage();
    expect(screen.getByText(/sem dados|no statistics/i)).toBeInTheDocument();
  });
});
