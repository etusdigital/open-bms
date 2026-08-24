import { StatisticsService } from './statistics.service';

/**
 * Regression coverage for EVO-1453: dashboard counter cards rendered as 0% / NaN
 * when the per-day row from Redis or the SQL LEFT JOIN was missing one or more
 * top-level counters. `sumStatisticsValues` is a pure reducer — we construct
 * the service with nulls because it never reads its deps here.
 */
describe('StatisticsService.sumStatisticsValues', () => {
  const service = new StatisticsService(
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    { getClient: () => ({}) } as any,
    null as any,
    null as any,
    null as any,
    null as any,
  );

  const zeros = () => ({
    delivered: 0,
    open: 0,
    click: 0,
    unsubscribe: 0,
    bounce: 0,
    blocked: 0,
    sent: 0,
    close: 0,
    unique_opens: 0,
    unique_clicks: 0,
  });

  it('does not produce NaN when the row is empty', () => {
    const result = service.sumStatisticsValues(zeros(), {});
    Object.values(result).forEach((v) => expect(Number.isNaN(v)).toBe(false));
  });

  it('treats missing counters as 0 (partial row from Redis hash)', () => {
    const result = service.sumStatisticsValues(zeros(), { open: '5', unique_opens: '3' });
    expect(result.open).toBe(5);
    expect(result.unique_opens).toBe(3);
    expect(result.delivered).toBe(0);
    expect(result.click).toBe(0);
    expect(result.unsubscribe).toBe(0);
    expect(result.bounce).toBe(0);
  });

  it('survives null/undefined fields without poisoning the accumulator', () => {
    const result = service.sumStatisticsValues(zeros(), {
      delivered: null,
      click: undefined,
      bounce: null,
      unsubscribe: undefined,
      open: '10',
      sent: '10',
    });
    expect(result.open).toBe(10);
    expect(result.sent).toBe(10);
    expect(result.delivered).toBe(0);
    expect(result.click).toBe(0);
    expect(result.bounce).toBe(0);
    expect(result.unsubscribe).toBe(0);
  });

  it('sums across multiple rows where each row has different missing fields', () => {
    let acc = zeros();
    acc = service.sumStatisticsValues(acc, { delivered: '10', open: '5' });
    acc = service.sumStatisticsValues(acc, { click: '2' });
    acc = service.sumStatisticsValues(acc, {});
    acc = service.sumStatisticsValues(acc, { delivered: '7', bounce: '1' });

    expect(acc.delivered).toBe(17);
    expect(acc.open).toBe(5);
    expect(acc.click).toBe(2);
    expect(acc.bounce).toBe(1);
    expect(Number.isNaN(acc.unsubscribe)).toBe(false);
  });
});

describe('StatisticsService.toIdList', () => {
  const service = new StatisticsService(
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    { getClient: () => ({}) } as any,
    null as any,
    null as any,
    null as any,
    null as any,
  );
  const toIdList = (value: unknown) => (service as any).toIdList(value);

  it('turns an index-keyed object (qs arrayLimit overflow) back into an array', () => {
    expect(toIdList({ '0': '1', '1': '2', '2': '3' })).toEqual(['1', '2', '3']);
  });

  it('keeps arrays and the "all" sentinel untouched and wraps scalars', () => {
    expect(toIdList(['1', '2'])).toEqual(['1', '2']);
    expect(toIdList('all')).toBe('all');
    expect(toIdList('7')).toEqual(['7']);
  });
});
