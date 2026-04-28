import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import InsightsPage from '../insights-page';
import type { InsightsApiResponse } from '../types';

let mockQueryReturn: Record<string, unknown> = {};

vi.mock('../use-insights', () => ({
  useInsights: () => mockQueryReturn,
}));

vi.mock('@/components/charts/echarts-base', () => ({
  EChartsBase: ({ option, height }: { option: unknown; height?: number }) => (
    <div data-testid="echarts-mock" data-height={height} data-series-count={(option as any)?.series?.length ?? 0} />
  ),
}));

function renderPage() {
  return renderWithRouter(<InsightsPage period="last48" />);
}

const mockData: InsightsApiResponse = [
  {
    date: '2026-04-07',
    delivered: { '06': 91112, '07': 4774, '18': 157587 },
    open: { '06': 9151, '07': 7473, '18': 14112 },
    click: { '06': 1134, '07': 1245, '18': 1433 },
    unsubscribe: { '06': 14, '07': 19, '18': 35 },
    bounce: { '06': 35, '07': 10, '18': 41 },
  },
  {
    date: '2026-04-08',
    delivered: { '06': 90662, '09': 79963, '12': 68634 },
    open: { '06': 6869, '09': 10899, '12': 11376 },
    click: { '06': 854, '09': 1650, '12': 1557 },
    unsubscribe: { '06': 42, '09': 35, '12': 34 },
    bounce: { '06': 31, '09': 20, '12': 14 },
  },
];

describe('InsightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockQueryReturn = { data: undefined, isLoading: true, error: null };
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Insights')).toBeInTheDocument();
    });

    it('shows 5 loading skeletons', async () => {
      await renderPage();
      const pulsingElements = document.querySelectorAll('.animate-pulse');
      expect(pulsingElements.length).toBe(5);
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockQueryReturn = { data: [], isLoading: false, error: null };
    });

    it('shows no data message when response is empty array', async () => {
      await renderPage();
      expect(screen.getByText(/nenhum dado/i)).toBeInTheDocument();
    });

    it('shows no data when all dates are null', async () => {
      mockQueryReturn = {
        data: [{ date: null }, { date: null }],
        isLoading: false,
        error: null,
      };
      await renderPage();
      expect(screen.getByText(/nenhum dado/i)).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockData, isLoading: false, error: null };
    });

    it('renders all 5 metric chart cards', async () => {
      await renderPage();
      expect(screen.getByText('Entregue')).toBeInTheDocument();
      expect(screen.getByText('Abertura')).toBeInTheDocument();
      expect(screen.getByText('Clique')).toBeInTheDocument();
      expect(screen.getByText('Insc. cancelada')).toBeInTheDocument();
      expect(screen.getByText('Bounce')).toBeInTheDocument();
    });

    it('renders 5 ECharts instances', async () => {
      await renderPage();
      const charts = screen.getAllByTestId('echarts-mock');
      expect(charts).toHaveLength(5);
    });

    it('each chart has one series per day (2 days = 2 series)', async () => {
      await renderPage();
      const charts = screen.getAllByTestId('echarts-mock');
      charts.forEach((chart) => {
        expect(chart.getAttribute('data-series-count')).toBe('2');
      });
    });

    it('each chart has height 300', async () => {
      await renderPage();
      const charts = screen.getAllByTestId('echarts-mock');
      charts.forEach((chart) => {
        expect(chart.getAttribute('data-height')).toBe('300');
      });
    });
  });

  describe('period selector', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockData, isLoading: false, error: null };
    });

    it('renders period dropdown with "Yesterday and Today" as passed period', async () => {
      await renderPage();
      expect(screen.getByText('Ontem e Hoje')).toBeInTheDocument();
    });
  });

  describe('data filtering', () => {
    it('filters out days with null dates', async () => {
      mockQueryReturn = {
        data: [...mockData, { date: null, delivered: { '06': 100 } }],
        isLoading: false,
        error: null,
      };
      await renderPage();
      const charts = screen.getAllByTestId('echarts-mock');
      // Should still be 2 series (null date filtered out), not 3
      charts.forEach((chart) => {
        expect(chart.getAttribute('data-series-count')).toBe('2');
      });
    });

    it('handles non-array response gracefully', async () => {
      mockQueryReturn = { data: null, isLoading: false, error: null };
      await renderPage();
      expect(screen.getByText(/nenhum dado/i)).toBeInTheDocument();
    });
  });
});
