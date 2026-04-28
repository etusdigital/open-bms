import { describe, it, expect } from 'vitest';
import {
  buildEmailNumericOption,
  buildEmailPercentageOption,
  buildPushNumericOption,
  buildPerUserOption,
} from '../components/chart/chart-options';
import type { StatisticsTableRow } from '../types';

const t = (key: string) => key;

const mockRow: StatisticsTableRow = {
  date: '2026-04-01T05:00:00.000Z',
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
  percentageOpen: 50,
  percentageUniqueOpen: 40,
  percentageClick: 10,
  percentageUniqueClick: 8,
  percentageCtor: 20,
  percentageUto: 2,
  percentageUnsubscribe: 1,
  percentageBounce: 0.4,
  percentageDelivered: 83.33,
  percentageClose: 0.2,
  percentageUserOpen: 37.5,
  percentageUserClick: 6.25,
  percentageUserUnsubscribe: 0.5,
  percentageUserBounce: 0.25,
};

const data = [mockRow];

describe('buildEmailNumericOption', () => {
  it('returns an option with 7 series', () => {
    const opt = buildEmailNumericOption(data, t, 'pt-BR');
    expect((opt.series as unknown[]).length).toBe(7);
  });

  it('includes legend and grid', () => {
    const opt = buildEmailNumericOption(data, t, 'pt-BR');
    expect(opt.legend).toBeDefined();
    expect(opt.grid).toBeDefined();
  });

  it('formats xAxis categories as DD/MM', () => {
    const opt = buildEmailNumericOption(data, t, 'pt-BR');
    const xAxis = opt.xAxis as { data: string[] };
    expect(xAxis.data[0]).toMatch(/^\d{2}\/\d{2}$/);
  });

  it('sets per-series colors via itemStyle.color', () => {
    const opt = buildEmailNumericOption(data, t, 'pt-BR');
    const series = opt.series as Array<{ itemStyle: { color: string } }>;
    for (const s of series) {
      expect(s.itemStyle.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('uses smooth: 0.3 on all series', () => {
    const opt = buildEmailNumericOption(data, t, 'pt-BR');
    const series = opt.series as Array<{ smooth: number }>;
    for (const s of series) {
      expect(s.smooth).toBe(0.3);
    }
  });
});

describe('buildEmailPercentageOption', () => {
  it('returns 6 series (no Delivered)', () => {
    const opt = buildEmailPercentageOption(data, t, 'pt-BR');
    expect((opt.series as unknown[]).length).toBe(6);
  });

  it('uses percentage data values', () => {
    const opt = buildEmailPercentageOption(data, t, 'pt-BR');
    const firstSeries = (opt.series as Array<{ data: number[] }>)[0];
    expect(firstSeries.data[0]).toBe(50); // percentageOpen
  });
});

describe('buildPushNumericOption', () => {
  it('returns 3 series without close for non-webpush', () => {
    const opt = buildPushNumericOption(data, t, 'pt-BR', false);
    expect((opt.series as unknown[]).length).toBe(3);
  });

  it('returns 4 series with close for webpush', () => {
    const opt = buildPushNumericOption(data, t, 'pt-BR', true);
    expect((opt.series as unknown[]).length).toBe(4);
  });
});

describe('buildPerUserOption', () => {
  it('returns 6 series (3 lines + 2 bars + 1 line)', () => {
    const opt = buildPerUserOption(data, t, 'pt-BR');
    expect((opt.series as unknown[]).length).toBe(6);
  });

  it('has dual yAxis', () => {
    const opt = buildPerUserOption(data, t, 'pt-BR');
    expect(Array.isArray(opt.yAxis)).toBe(true);
    expect((opt.yAxis as unknown[]).length).toBe(2);
  });

  it('sets boundaryGap to true for bar charts', () => {
    const opt = buildPerUserOption(data, t, 'pt-BR');
    const xAxis = opt.xAxis as { boundaryGap: boolean };
    expect(xAxis.boundaryGap).toBe(true);
  });

  it('has bar type series for rates', () => {
    const opt = buildPerUserOption(data, t, 'pt-BR');
    const series = opt.series as Array<{ type: string }>;
    const barSeries = series.filter((s) => s.type === 'bar');
    expect(barSeries.length).toBe(2);
  });
});

describe('chart options with empty data', () => {
  it('does not crash with empty array', () => {
    expect(() => buildEmailNumericOption([], t)).not.toThrow();
    expect(() => buildEmailPercentageOption([], t)).not.toThrow();
    expect(() => buildPushNumericOption([], t, 'pt-BR', true)).not.toThrow();
    expect(() => buildPerUserOption([], t)).not.toThrow();
  });
});
