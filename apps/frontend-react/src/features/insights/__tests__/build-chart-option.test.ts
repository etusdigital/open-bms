import { describe, it, expect } from 'vitest';
import type { InsightsDayData, InsightsMetricKey } from '../types';
import { HOURS } from '../types';

/**
 * Extracted buildChartOption logic for testing.
 * Tests the data transformation: daily hourly data → ECharts series.
 */
function buildSeriesData(days: InsightsDayData[], metricKey: InsightsMetricKey) {
  return days.map((day) => {
    const hourlyData = day[metricKey] as Record<string, number> | undefined;
    return HOURS.map((_, h) => {
      const hourKey = String(h).padStart(2, '0');
      return hourlyData?.[hourKey] ?? 0;
    });
  });
}

/** Mirror of getDayColor from insights-page.tsx */
const DAY_COLORS = ['#0057f4', '#00cefc', '#ff9654', '#f06158', '#800080', '#436bba', '#0FB75C', '#C6315C'];

function getDayColor(dayIndex: number, totalDays: number): string {
  const offset = DAY_COLORS.length - totalDays;
  return DAY_COLORS[(offset + dayIndex) % DAY_COLORS.length];
}

const mockDays: InsightsDayData[] = [
  {
    date: '2026-04-07',
    delivered: { '06': 91112, '07': 4774, '18': 157587 },
    open: { '10': 7822, '11': 7113 },
    click: {},
    bounce: { '06': 35 },
  },
  {
    date: '2026-04-08',
    delivered: { '06': 90662, '09': 79963 },
    open: { '10': 8022 },
  },
];

describe('buildSeriesData (insights chart data transformation)', () => {
  it('returns one array per day', () => {
    const result = buildSeriesData(mockDays, 'delivered');
    expect(result).toHaveLength(2);
  });

  it('each array has 24 entries (one per hour)', () => {
    const result = buildSeriesData(mockDays, 'delivered');
    result.forEach((dayData) => {
      expect(dayData).toHaveLength(24);
    });
  });

  it('maps hourly values correctly', () => {
    const result = buildSeriesData(mockDays, 'delivered');
    expect(result[0][6]).toBe(91112);
    expect(result[0][7]).toBe(4774);
    expect(result[0][18]).toBe(157587);
  });

  it('fills missing hours with 0', () => {
    const result = buildSeriesData(mockDays, 'delivered');
    expect(result[0][0]).toBe(0);
    expect(result[0][23]).toBe(0);
  });

  it('handles missing metric key on a day', () => {
    const result = buildSeriesData(mockDays, 'unsubscribe');
    result.forEach((dayData) => {
      dayData.forEach((value) => {
        expect(value).toBe(0);
      });
    });
  });

  it('handles empty hourly object', () => {
    const result = buildSeriesData(mockDays, 'click');
    expect(result[0].every((v) => v === 0)).toBe(true);
  });

  it('handles metric with sparse hours', () => {
    const result = buildSeriesData(mockDays, 'bounce');
    expect(result[0][6]).toBe(35);
    expect(result[0][5]).toBe(0);
    expect(result[0][7]).toBe(0);
  });

  it('works with empty days array', () => {
    const result = buildSeriesData([], 'delivered');
    expect(result).toHaveLength(0);
  });
});

describe('getDayColor (consistent color assignment)', () => {
  it('assigns last 2 colors to 2-day view (48h)', () => {
    const yesterday48h = getDayColor(0, 2);
    const today48h = getDayColor(1, 2);
    expect(yesterday48h).toBe(DAY_COLORS[6]); // '#0FB75C'
    expect(today48h).toBe(DAY_COLORS[7]); // '#C6315C'
  });

  it('assigns same last 2 colors to last 2 days in 8-day view (7d)', () => {
    const yesterday7d = getDayColor(6, 8);
    const today7d = getDayColor(7, 8);
    expect(yesterday7d).toBe(DAY_COLORS[6]); // '#0FB75C'
    expect(today7d).toBe(DAY_COLORS[7]); // '#C6315C'
  });

  it('yesterday and today have same colors in both 48h and 7d views', () => {
    // 48h: 2 days, yesterday = index 0, today = index 1
    const yesterday48h = getDayColor(0, 2);
    const today48h = getDayColor(1, 2);

    // 7d: 8 days, yesterday = index 6, today = index 7
    const yesterday7d = getDayColor(6, 8);
    const today7d = getDayColor(7, 8);

    expect(yesterday48h).toBe(yesterday7d);
    expect(today48h).toBe(today7d);
  });

  it('oldest day in 7d gets the first color', () => {
    expect(getDayColor(0, 8)).toBe(DAY_COLORS[0]);
  });

  it('each day in a full 8-day view gets a unique color', () => {
    const colors = Array.from({ length: 8 }, (_, i) => getDayColor(i, 8));
    expect(new Set(colors).size).toBe(8);
  });

  it('wraps gracefully if more days than colors', () => {
    // 10 days > 8 colors — should wrap without crashing
    expect(() => getDayColor(9, 10)).not.toThrow();
  });
});

describe('HOURS constant', () => {
  it('has 24 entries', () => {
    expect(HOURS).toHaveLength(24);
  });

  it('starts with 00H and ends with 23H', () => {
    expect(HOURS[0]).toBe('00H');
    expect(HOURS[23]).toBe('23H');
  });

  it('all entries are formatted as NNH', () => {
    HOURS.forEach((h) => {
      expect(h).toMatch(/^\d{2}H$/);
    });
  });
});
