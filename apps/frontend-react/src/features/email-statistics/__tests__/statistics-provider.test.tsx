import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { use } from 'react';
import { StatisticsProvider } from '../context/statistics-provider';
import { StatisticsContext } from '../context/statistics-context';
import type { StatisticsSearchParams } from '../statistics-search-schema';
import type { StatisticsResponse } from '../types';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

const mockResponse: StatisticsResponse = {
  general: {
    delivered: 1000,
    open: 500,
    unique_opens: 400,
    click: 100,
    unique_clicks: 80,
    unsubscribe: 10,
    bounce: 5,
    sent: 1200,
    close: 3,
    unique_user_delivered: 800,
    unique_user_open: 300,
    unique_user_click: 50,
    unique_user_unsubscribe: 5,
    unique_user_bounce: 2,
    opens_per_contact: 1.5,
    clicks_per_contact: 0.3,
  },
  daily: [
    {
      date: '2026-04-01',
      delivered: 500,
      open: 250,
      unique_opens: 200,
      click: 50,
      unique_clicks: 40,
      unsubscribe: 5,
      bounce: 2,
      sent: 600,
      close: 1,
      unique_user_delivered: 400,
      unique_user_open: 150,
      unique_user_click: 25,
      unique_user_unsubscribe: 2,
      unique_user_bounce: 1,
      opens_per_contact: 1.5,
      clicks_per_contact: 0.3,
    },
    {
      date: '2026-04-02',
      delivered: 500,
      open: 250,
      unique_opens: 200,
      click: 50,
      unique_clicks: 40,
      unsubscribe: 5,
      bounce: 3,
      sent: 600,
      close: 2,
      unique_user_delivered: 400,
      unique_user_open: 150,
      unique_user_click: 25,
      unique_user_unsubscribe: 3,
      unique_user_bounce: 1,
      opens_per_contact: 1.4,
      clicks_per_contact: 0.2,
    },
  ],
};

let mockQueryReturn: Record<string, unknown> = {};

vi.mock('../use-email-statistics', () => ({
  useEmailStatistics: () => mockQueryReturn,
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

function TestConsumer() {
  const ctx = use(StatisticsContext);
  if (!ctx) return <div>no context</div>;
  return (
    <div>
      <div data-testid="loading">{String(ctx.isLoading)}</div>
      <div data-testid="message-type">{ctx.messageType}</div>
      <div data-testid="display-mode">{ctx.displayMode}</div>
      <div data-testid="show-per-user">{String(ctx.showPerUser)}</div>
      <div data-testid="table-rows">{ctx.tableData.length}</div>
      {ctx.general && <div data-testid="delivered">{ctx.general.delivered}</div>}
      {ctx.tableData.length > 0 && (
        <>
          <div data-testid="first-row-pct-open">{ctx.tableData[0].percentageOpen}</div>
          <div data-testid="first-row-date">{ctx.tableData[0].date}</div>
        </>
      )}
    </div>
  );
}

describe('StatisticsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides loading state', () => {
    mockQueryReturn = { data: undefined, isLoading: true, isFetching: true };
    render(
      <StatisticsProvider searchParams={defaultParams} messageType="email">
        <TestConsumer />
      </StatisticsProvider>,
    );
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('table-rows')).toHaveTextContent('0');
  });

  it('provides data with computed percentages', () => {
    mockQueryReturn = { data: mockResponse, isLoading: false, isFetching: false };
    render(
      <StatisticsProvider searchParams={defaultParams} messageType="email">
        <TestConsumer />
      </StatisticsProvider>,
    );
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('delivered')).toHaveTextContent('1000');
    expect(screen.getByTestId('table-rows')).toHaveTextContent('2');
    // 250 / 500 = 50%
    expect(screen.getByTestId('first-row-pct-open')).toHaveTextContent('50');
  });

  it('provides correct message type', () => {
    mockQueryReturn = { data: undefined, isLoading: true, isFetching: true };
    render(
      <StatisticsProvider searchParams={defaultParams} messageType="web-push">
        <TestConsumer />
      </StatisticsProvider>,
    );
    expect(screen.getByTestId('message-type')).toHaveTextContent('web-push');
  });

  it('defaults to numeric display mode', () => {
    mockQueryReturn = { data: undefined, isLoading: true, isFetching: true };
    render(
      <StatisticsProvider searchParams={defaultParams} messageType="email">
        <TestConsumer />
      </StatisticsProvider>,
    );
    expect(screen.getByTestId('display-mode')).toHaveTextContent('numeric');
    expect(screen.getByTestId('show-per-user')).toHaveTextContent('false');
  });

  it('handles empty daily array', () => {
    mockQueryReturn = {
      data: { general: mockResponse.general, daily: [] },
      isLoading: false,
      isFetching: false,
    };
    render(
      <StatisticsProvider searchParams={defaultParams} messageType="email">
        <TestConsumer />
      </StatisticsProvider>,
    );
    expect(screen.getByTestId('table-rows')).toHaveTextContent('0');
  });

  it('handles null/undefined data gracefully', () => {
    mockQueryReturn = { data: null, isLoading: false, isFetching: false };
    expect(() => {
      render(
        <StatisticsProvider searchParams={defaultParams} messageType="email">
          <TestConsumer />
        </StatisticsProvider>,
      );
    }).not.toThrow();
    expect(screen.getByTestId('table-rows')).toHaveTextContent('0');
  });

  it('computes percentage as 0 when delivered is 0', () => {
    const zeroData: StatisticsResponse = {
      general: { ...mockResponse.general, delivered: 0 },
      daily: [
        {
          date: '2026-04-01',
          delivered: 0,
          open: 0,
          unique_opens: 0,
          click: 0,
          unique_clicks: 0,
          unsubscribe: 0,
          bounce: 0,
          sent: 100,
          close: 0,
          unique_user_delivered: 0,
          unique_user_open: 0,
          unique_user_click: 0,
          unique_user_unsubscribe: 0,
          unique_user_bounce: 0,
          opens_per_contact: 0,
          clicks_per_contact: 0,
        },
      ],
    };
    mockQueryReturn = { data: zeroData, isLoading: false, isFetching: false };
    render(
      <StatisticsProvider searchParams={defaultParams} messageType="email">
        <TestConsumer />
      </StatisticsProvider>,
    );
    expect(screen.getByTestId('first-row-pct-open')).toHaveTextContent('0');
  });

  it('filters out daily rows with null dates', () => {
    const dataWithNulls: StatisticsResponse = {
      general: mockResponse.general,
      daily: [
        { ...mockResponse.daily[0], date: '2026-04-01T00:00:00.000Z' },
        { ...mockResponse.daily[1], date: null as unknown as string },
        { ...mockResponse.daily[0], date: null as unknown as string },
      ],
    };
    mockQueryReturn = { data: dataWithNulls, isLoading: false, isFetching: false };
    render(
      <StatisticsProvider searchParams={defaultParams} messageType="email">
        <TestConsumer />
      </StatisticsProvider>,
    );
    expect(screen.getByTestId('table-rows')).toHaveTextContent('1');
  });

  it('sorts daily rows ascending by date', () => {
    const unsorted: StatisticsResponse = {
      general: mockResponse.general,
      daily: [
        { ...mockResponse.daily[0], date: '2026-04-03T00:00:00.000Z' },
        { ...mockResponse.daily[1], date: '2026-04-01T00:00:00.000Z' },
        { ...mockResponse.daily[0], date: '2026-04-02T00:00:00.000Z' },
      ],
    };
    mockQueryReturn = { data: unsorted, isLoading: false, isFetching: false };
    render(
      <StatisticsProvider searchParams={defaultParams} messageType="email">
        <TestConsumer />
      </StatisticsProvider>,
    );
    expect(screen.getByTestId('first-row-date')).toHaveTextContent('2026-04-01');
  });
});
