import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import EmailStatisticsPage from '../email-statistics-page';
import type { StatisticsResponse } from '../types';
import type { StatisticsSearchParams } from '../statistics-search-schema';

const mockResponse: StatisticsResponse = {
  general: {
    delivered: 16026370,
    open: 5554422,
    unique_opens: 4382343,
    click: 605132,
    unique_clicks: 444045,
    unsubscribe: 16283,
    bounce: 2145,
    sent: 17000000,
    close: 500,
    unique_user_delivered: 8000000,
    unique_user_open: 3000000,
    unique_user_click: 500000,
    unique_user_unsubscribe: 5000,
    unique_user_bounce: 1000,
    opens_per_contact: 1.5,
    clicks_per_contact: 0.3,
  },
  daily: [
    {
      date: '2026-04-06',
      delivered: 464306,
      open: 174216,
      unique_opens: 135868,
      click: 25886,
      unique_clicks: 20609,
      unsubscribe: 464,
      bounce: 114,
      sent: 500000,
      close: 10,
      unique_user_delivered: 400000,
      unique_user_open: 150000,
      unique_user_click: 20000,
      unique_user_unsubscribe: 200,
      unique_user_bounce: 50,
      opens_per_contact: 1.4,
      clicks_per_contact: 0.2,
    },
    {
      date: '2026-04-07',
      delivered: 102924,
      open: 32785,
      unique_opens: 27967,
      click: 2201,
      unique_clicks: 1433,
      unsubscribe: 114,
      bounce: 15,
      sent: 110000,
      close: 2,
      unique_user_delivered: 90000,
      unique_user_open: 30000,
      unique_user_click: 2000,
      unique_user_unsubscribe: 50,
      unique_user_bounce: 10,
      opens_per_contact: 1.3,
      clicks_per_contact: 0.1,
    },
  ],
};

let mockQueryReturn: Record<string, unknown> = {};

vi.mock('../use-email-statistics', () => ({
  useEmailStatistics: () => mockQueryReturn,
}));

const emptyQueryResult = { data: [], isLoading: false, isFetching: false };
vi.mock('../use-filter-options', () => ({
  useCampaignOptions: () => emptyQueryResult,
  useAutomationOptions: () => emptyQueryResult,
  useMessageOptions: () => emptyQueryResult,
  useTagOptions: () => emptyQueryResult,
  useSegmentOptions: () => emptyQueryResult,
  useSenderOptions: () => emptyQueryResult,
}));

// Mock ECharts to avoid canvas issues in jsdom
vi.mock('@/components/charts/echarts-base', () => ({
  EChartsBase: ({ option }: { option: unknown }) => (
    <div data-testid="echarts-mock">{option ? 'chart-rendered' : 'no-option'}</div>
  ),
}));

// Mock MessageTypeTabs — the real component uses a Zustand selector that returns
// a new object on every call, triggering an infinite re-render loop in tests.
vi.mock('../components/message-type-tabs', () => ({
  MessageTypeTabs: ({ activeType }: { activeType: string }) => <div data-testid="message-type-tabs">{activeType}</div>,
}));

const defaultParams: StatisticsSearchParams = {
  channel: 'email',
  startDate: '2026-03-08',
  endDate: '2026-04-07',
  displayMode: 'numeric',
  showPerUser: false,
  sortBy: 'date',
  sortDesc: true,
  campaigns: '',
  automations: '',
  messages: '',
  tags: '',
  segments: '',
  senders: '',
  subUsers: '',
};

function renderPage(params: Partial<StatisticsSearchParams> = {}) {
  return renderWithRouter(<EmailStatisticsPage searchParams={{ ...defaultParams, ...params }} />);
}

describe('EmailStatisticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore({
      permissions: ['analytics:dashboard_view', 'analytics:dashboard_export'],
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockQueryReturn = { data: undefined, isLoading: true, isFetching: true };
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Estatísticas')).toBeInTheDocument();
    });

    it('shows loading skeletons for cards', async () => {
      await renderPage();
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('with data', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockResponse, isLoading: false, isFetching: false };
    });

    it('renders all 8 email metric cards', async () => {
      await renderPage();
      // Use getAllByText for labels that appear in both cards and table headers
      expect(screen.getAllByText('Entregue').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Abertura').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Abertura Única').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Clique').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Clique Único').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('CTOR').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Insc. cancelada').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Bounce').length).toBeGreaterThanOrEqual(1);
    });

    it('renders delivered count in the card', async () => {
      await renderPage();
      expect(screen.getByText('16.026.370')).toBeInTheDocument();
    });

    it('renders the chart', async () => {
      await renderPage();
      expect(screen.getByTestId('echarts-mock')).toHaveTextContent('chart-rendered');
    });

    it('renders table with date column', async () => {
      await renderPage();
      expect(screen.getByText('Data')).toBeInTheDocument();
    });

    it('renders table rows with dates', async () => {
      await renderPage();
      expect(screen.getByText('07/04/2026')).toBeInTheDocument();
      expect(screen.getByText('06/04/2026')).toBeInTheDocument();
    });

    it('renders chart type toggle', async () => {
      await renderPage();
      // The toggle has # and % icons
      expect(screen.getByTitle('Numérico')).toBeInTheDocument();
      expect(screen.getByTitle('Percentual')).toBeInTheDocument();
    });
  });

  describe('default date range', () => {
    it('does not crash when dates are empty (fills defaults)', async () => {
      mockQueryReturn = { data: undefined, isLoading: true, isFetching: true };
      await expect(renderPage({ startDate: '', endDate: '' })).resolves.toBeDefined();
    });

    it('does not cause infinite re-render loop with empty dates', async () => {
      mockQueryReturn = { data: undefined, isLoading: true, isFetching: true };
      // This would throw "Maximum update depth exceeded" if there's a loop
      const { unmount } = await renderPage({ startDate: '', endDate: '' });
      unmount();
    });
  });

  describe('with null/undefined data values', () => {
    it('does not crash when general data has null values', async () => {
      const nullData = {
        ...mockResponse,
        general: {
          ...mockResponse.general,
          delivered: null as unknown as number,
          open: null as unknown as number,
        },
      };
      mockQueryReturn = { data: nullData, isLoading: false, isFetching: false };
      await expect(renderPage()).resolves.toBeDefined();
    });

    it('does not crash with completely empty response', async () => {
      mockQueryReturn = { data: { general: {}, daily: [] }, isLoading: false, isFetching: false };
      await expect(renderPage()).resolves.toBeDefined();
    });
  });

  describe('web-push mode', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockResponse, isLoading: false, isFetching: false };
    });

    it('renders push-specific cards', async () => {
      await renderWithRouter(<EmailStatisticsPage searchParams={{ ...defaultParams, channel: 'web-push' }} />);
      expect(screen.getAllByText('Enviados').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Entregue').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Clique').length).toBeGreaterThanOrEqual(1);
    });
  });
});
