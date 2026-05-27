import { Logger } from '@nestjs/common';
import { ClickhouseProvider } from './clickhouse.provider';

// Stub the @clickhouse/client `createClient` so we can drive the
// query()/json() shape from each test without touching a real cluster.
type QueryResult = { json: jest.Mock };
type QueryFn = jest.Mock<Promise<QueryResult>, [{ query: string; query_params?: Record<string, unknown> }]>;
const mockQuery: QueryFn = jest.fn();

jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn(() => ({ query: mockQuery })),
}));

describe('ClickhouseProvider', () => {
  let provider: ClickhouseProvider;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockQuery.mockReset();
    provider = new ClickhouseProvider();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a fast query at log level with the compacted SQL + row count + ms', async () => {
    mockQuery.mockResolvedValue({ json: jest.fn().mockResolvedValue([{ a: 1 }, { a: 2 }]) });

    await provider.runQuery('SELECT\n  a\nFROM events_logs_v2\nWHERE account_id = {accountId:UInt32}', {
      accountId: 42,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const message = logSpy.mock.calls[0][0] as string;
    expect(message).toMatch(/^\[CH\] \d+ms → 2 rows · SELECT a FROM events_logs_v2 WHERE account_id = \{accountId:UInt32\} · params=\{"accountId":42\}$/);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs a slow query (≥ 1000ms) at warn level', async () => {
    // Force elapsed to be ≥ threshold by stepping the clock during the query.
    const originalNow = Date.now;
    let nowCallCount = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      nowCallCount += 1;
      // 1st call (start): return 0; 2nd call (end): return 1500ms later.
      return nowCallCount === 1 ? 0 : 1500;
    });
    mockQuery.mockResolvedValue({ json: jest.fn().mockResolvedValue([]) });

    try {
      await provider.runQuery('SELECT 1');
    } finally {
      Date.now = originalNow;
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0] as string).toMatch(/^\[CH\] 1500ms → 0 rows ·/);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs an errored query at error level and re-throws', async () => {
    mockQuery.mockRejectedValue(new Error('CH unreachable'));

    await expect(provider.runQuery('SELECT 1')).rejects.toThrow('CH unreachable');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const message = errorSpy.mock.calls[0][0] as string;
    expect(message).toMatch(/^\[CH\] \d+ms failed · SELECT 1 · params=∅$/);
  });

  it('returns the rows from JSONEachRow .json()', async () => {
    mockQuery.mockResolvedValue({
      json: jest.fn().mockResolvedValue([
        { id: 1, title: 'a' },
        { id: 2, title: 'b' },
      ]),
    });

    const rows = await provider.runQuery<{ id: number; title: string }>('SELECT id, title FROM messages');

    expect(rows).toEqual([
      { id: 1, title: 'a' },
      { id: 2, title: 'b' },
    ]);
  });

  it('passes params + JSONEachRow format + int-unquote setting to the client', async () => {
    mockQuery.mockResolvedValue({ json: jest.fn().mockResolvedValue([]) });

    await provider.runQuery('SELECT 1', { foo: 'bar' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'SELECT 1',
        query_params: { foo: 'bar' },
        format: 'JSONEachRow',
        clickhouse_settings: expect.objectContaining({ output_format_json_quote_64bit_integers: 0 }),
      }),
    );
  });
});
