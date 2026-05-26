import { ActivityService } from './activity.service';

describe('ActivityService', () => {
  const makeService = (rows: any[], accountRows: Array<{ id: number }> = []) => {
    const clickhouse = { runQuery: jest.fn().mockResolvedValue(rows) } as any;
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(accountRows),
    };
    const accountsRepo = { createQueryBuilder: jest.fn(() => qb) } as any;
    return { service: new ActivityService(clickhouse, accountsRepo), clickhouse, qb };
  };

  it('pins message_type=email and projects expected columns', async () => {
    const { service, clickhouse } = makeService([]);
    await service.queryEvents({ q: '' });
    const sql: string = clickhouse.runQuery.mock.calls[0][0];
    expect(sql).toContain("message_type = 'email'");
    expect(sql).toContain('FROM events_logs_v2');
    expect(sql).toMatch(/ORDER BY time DESC, events_logs_id DESC/);
    expect(sql).toMatch(/LIMIT 51 OFFSET 0/);
  });

  it('passes through parsed filters into WHERE', async () => {
    const { service, clickhouse } = makeService([]);
    await service.queryEvents({ q: 'account:42 -event:dropped' });
    const sql: string = clickhouse.runQuery.mock.calls[0][0];
    expect(sql).toContain('account_id = 42');
    expect(sql).toContain("event != 'dropped'");
  });

  it('resolves account:name via Postgres ILIKE and rewrites to IN(ids)', async () => {
    const { service, clickhouse } = makeService([], [{ id: 7 }, { id: 9 }]);
    await service.queryEvents({ q: 'account:acme' });
    const sql: string = clickhouse.runQuery.mock.calls[0][0];
    expect(sql).toMatch(/account_id IN \(7, 9\)/);
  });

  it('forces empty result when account name resolves to nothing', async () => {
    const { service, clickhouse } = makeService([], []);
    await service.queryEvents({ q: 'account:ghost' });
    const sql: string = clickhouse.runQuery.mock.calls[0][0];
    expect(sql).toContain('account_id IN (-1)');
  });

  it('computes OFFSET from page', async () => {
    const { service, clickhouse } = makeService([]);
    await service.queryEvents({ q: '', page: 3, limit: 50 });
    expect(clickhouse.runQuery.mock.calls[0][0]).toMatch(/LIMIT 51 OFFSET 100/);
  });

  it('reports hasNext when results exceed limit and trims to limit', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      events_logs_id: String(1000 - i),
      time: `2026-05-2${i % 10} 12:00:00`,
    }));
    const { service } = makeService(rows);
    const result = await service.queryEvents({ q: '', limit: 50 });
    expect(result.events).toHaveLength(50);
    expect(result.hasNext).toBe(true);
  });

  it('clamps limit into [1, 200]', async () => {
    const { service, clickhouse } = makeService([]);
    await service.queryEvents({ q: '', limit: 9999 });
    expect(clickhouse.runQuery.mock.calls[0][0]).toMatch(/LIMIT 201 OFFSET 0/);
    await service.queryEvents({ q: '', limit: 1 });
    expect(clickhouse.runQuery.mock.calls[1][0]).toMatch(/LIMIT 2 OFFSET 0/);
  });
});
