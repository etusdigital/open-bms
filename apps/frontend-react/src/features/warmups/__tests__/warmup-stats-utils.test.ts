import { describe, it, expect } from 'vitest';
import { getPercentage, transformDailyData } from '../warmup-stats-utils';
import type { WarmupStatisticsDaily } from '../types';

describe('getPercentage', () => {
  it('returns percentage with 2 decimal places', () => {
    expect(getPercentage(50, 100)).toBe('50.00');
  });

  it('returns "0" when partial is 0', () => {
    expect(getPercentage(0, 100)).toBe('0');
  });

  it('returns "0" when total is 0', () => {
    expect(getPercentage(50, 0)).toBe('0');
  });

  it('returns "0" when both are 0', () => {
    expect(getPercentage(0, 0)).toBe('0');
  });

  it('handles decimal results', () => {
    expect(getPercentage(1, 3)).toBe('33.33');
  });

  it('handles 100%', () => {
    expect(getPercentage(200, 200)).toBe('100.00');
  });
});

describe('transformDailyData', () => {
  const sampleDaily: WarmupStatisticsDaily[] = [
    {
      date: '2026-04-03',
      delivered: 100,
      open: 50,
      click: 10,
      bounce: 5,
      unsubscribe: 2,
      sent: 120,
    },
    {
      date: '2026-04-01',
      delivered: 200,
      open: 100,
      click: 20,
      bounce: 10,
      unsubscribe: 4,
      sent: 220,
    },
    { date: '2026-04-02', delivered: 0, open: 0, click: 0, bounce: 0, unsubscribe: 0, sent: 0 },
  ];

  it('sorts by date ascending and filters out zero-only rows', () => {
    const result = transformDailyData(sampleDaily);
    // The all-zero row (2026-04-02) is filtered out
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-04-01');
    expect(result[1].date).toBe('2026-04-03');
  });

  it('includes pre-formatted date string', () => {
    const result = transformDailyData(sampleDaily);
    for (const row of result) {
      expect(row.formattedDate).toBeTruthy();
      expect(typeof row.formattedDate).toBe('string');
    }
  });

  it('calculates percentageOpen correctly', () => {
    const result = transformDailyData(sampleDaily);
    // 2026-04-01: open=100, delivered=200 → 50.00%
    expect(result[0].percentageOpen).toBe('50.00');
  });

  it('calculates percentageClick correctly', () => {
    const result = transformDailyData(sampleDaily);
    // 2026-04-01: click=20, delivered=200 → 10.00%
    expect(result[0].percentageClick).toBe('10.00');
  });

  it('calculates percentageCtor correctly (click/open)', () => {
    const result = transformDailyData(sampleDaily);
    // 2026-04-01: click=20, open=100 → 20.00%
    expect(result[0].percentageCtor).toBe('20.00');
  });

  it('calculates percentageUto correctly (unsubscribe/open)', () => {
    const result = transformDailyData(sampleDaily);
    // 2026-04-01: unsubscribe=4, open=100 → 4.00%
    expect(result[0].percentageUto).toBe('4.00');
  });

  it('calculates percentageBounce correctly', () => {
    const result = transformDailyData(sampleDaily);
    // 2026-04-01: bounce=10, delivered=200 → 5.00%
    expect(result[0].percentageBounce).toBe('5.00');
  });

  it('calculates percentageUnsubscribe correctly', () => {
    const result = transformDailyData(sampleDaily);
    // 2026-04-01: unsubscribe=4, delivered=200 → 2.00%
    expect(result[0].percentageUnsubscribe).toBe('2.00');
  });

  it('filters out rows with null date', () => {
    const withNullDate: WarmupStatisticsDaily[] = [
      {
        date: null as unknown as string,
        delivered: 0,
        open: 0,
        click: 0,
        bounce: 0,
        unsubscribe: 0,
        sent: 0,
      },
      {
        date: '2026-04-01',
        delivered: 100,
        open: 50,
        click: 10,
        bounce: 5,
        unsubscribe: 2,
        sent: 110,
      },
    ];
    const result = transformDailyData(withNullDate);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-04-01');
  });

  it('returns empty array for empty input', () => {
    expect(transformDailyData([])).toEqual([]);
  });
});
