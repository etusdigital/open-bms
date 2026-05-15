import { StatisticsAggregationService } from './statistics.aggregation';
import { RedisStatistics } from './statistics.interface';

/**
 * Minimal spec covering aggregateRedisData — the pure function touched by the
 * click-bot rollout. Dependencies aren't exercised; we construct the service
 * with nulls because aggregateRedisData never reads them.
 */
describe('StatisticsAggregationService.aggregateRedisData', () => {
  const service = new StatisticsAggregationService(null as any, { getClient: () => ({}) } as any, null as any, null as any);

  it('parses bot_click and datacenter_click scalars from the Redis hash', () => {
    const result = service.aggregateRedisData({
      click: '100',
      open: '200',
      bot_click: '25',
      datacenter_click: '40',
    } as RedisStatistics);

    expect(result.click).toBe(100);
    expect(result.open).toBe(200);
    expect(result.bot_click).toBe(25);
    expect(result.datacenter_click).toBe(40);
  });

  it('defaults bot_click and datacenter_click to 0 when fields are absent', () => {
    const result = service.aggregateRedisData({ click: '50' } as RedisStatistics);

    expect(result.click).toBe(50);
    expect(result.bot_click).toBe(0);
    expect(result.datacenter_click).toBe(0);
  });

  it('handles "0" as a valid non-null hash value', () => {
    const result = service.aggregateRedisData({
      click: '10',
      bot_click: '0',
      datacenter_click: '0',
    } as RedisStatistics);

    expect(result.bot_click).toBe(0);
    expect(result.datacenter_click).toBe(0);
  });

  it('treats bot_click as a subset of datacenter_click on well-formed data', () => {
    // Sanity: every is_bot click is also is_datacenter, so writer-side math
    // should keep bot_click <= datacenter_click. Aggregator passes through
    // cleanly either way — this just documents the invariant.
    const result = service.aggregateRedisData({
      click: '100',
      datacenter_click: '30',
      bot_click: '25',
    } as RedisStatistics);

    expect(result.bot_click).toBeLessThanOrEqual(result.datacenter_click);
    expect(result.datacenter_click).toBeLessThanOrEqual(result.click);
  });
});

describe('StatisticsAggregationService.onModuleInit', () => {
  const ORIGINAL = process.env.STATISTICS_AGGREGATION_INTERVAL_MS;

  function makeService(): StatisticsAggregationService {
    return new StatisticsAggregationService(null as any, { getClient: () => ({}) } as any, null as any, null as any);
  }

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.STATISTICS_AGGREGATION_INTERVAL_MS;
    else process.env.STATISTICS_AGGREGATION_INTERVAL_MS = ORIGINAL;
    jest.restoreAllMocks();
  });

  it('starts a 60s timer when the env var is unset', () => {
    delete process.env.STATISTICS_AGGREGATION_INTERVAL_MS;
    const spy = jest.spyOn(global, 'setInterval');
    const svc = makeService();
    svc.onModuleInit();
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    svc.onModuleDestroy();
  });

  it('treats an empty-string env var as unset (uses 60s default)', () => {
    process.env.STATISTICS_AGGREGATION_INTERVAL_MS = '';
    const spy = jest.spyOn(global, 'setInterval');
    const svc = makeService();
    svc.onModuleInit();
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    svc.onModuleDestroy();
  });

  it('disables the scheduler when the env var is "0"', () => {
    process.env.STATISTICS_AGGREGATION_INTERVAL_MS = '0';
    const spy = jest.spyOn(global, 'setInterval');
    const svc = makeService();
    svc.onModuleInit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('honors a custom interval override', () => {
    process.env.STATISTICS_AGGREGATION_INTERVAL_MS = '15000';
    const spy = jest.spyOn(global, 'setInterval');
    const svc = makeService();
    svc.onModuleInit();
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 15_000);
    svc.onModuleDestroy();
  });

  it('clears the timer on shutdown', () => {
    delete process.env.STATISTICS_AGGREGATION_INTERVAL_MS;
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const svc = makeService();
    svc.onModuleInit();
    svc.onModuleDestroy();
    expect(clearSpy).toHaveBeenCalled();
  });
});
