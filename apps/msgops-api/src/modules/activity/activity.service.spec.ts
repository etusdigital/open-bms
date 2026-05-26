import { ActivityService } from './activity.service';
import { encodeCursor } from './dto/activity-query.dto';

describe('ActivityService', () => {
  const makeService = (rows: any[]) => {
    const clickhouse = { runQuery: jest.fn().mockResolvedValue(rows) } as any;
    return { service: new ActivityService(clickhouse), clickhouse };
  };

  it('pins message_type=email and projects expected columns', async () => {
    const { service, clickhouse } = makeService([]);
    await service.queryEvents({ q: '' });
    const sql: string = clickhouse.runQuery.mock.calls[0][0];
    expect(sql).toContain("message_type = 'email'");
    expect(sql).toContain('FROM events_logs_v2');
    expect(sql).toMatch(/ORDER BY time DESC, events_logs_id DESC/);
    expect(sql).toMatch(/LIMIT 51/);
  });

  it('passes through parsed filters into WHERE', async () => {
    const { service, clickhouse } = makeService([]);
    await service.queryEvents({ q: 'account:42 -event:dropped' });
    const sql: string = clickhouse.runQuery.mock.calls[0][0];
    expect(sql).toContain('account_id = 42');
    expect(sql).toContain("event != 'dropped'");
  });

  it('returns nextCursor when results exceed limit and trims to limit', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      events_logs_id: String(1000 - i),
      time: `2026-05-2${i % 10} 12:00:00`,
    }));
    const { service } = makeService(rows);
    const result = await service.queryEvents({ q: '', limit: 50 });
    expect(result.events).toHaveLength(50);
    expect(result.nextCursor).not.toBeNull();
  });

  it('returns null cursor when results fit in one page', async () => {
    const { service } = makeService([{ events_logs_id: '1', time: '2026-05-20 00:00:00' }]);
    const result = await service.queryEvents({ q: '', limit: 50 });
    expect(result.nextCursor).toBeNull();
    expect(result.events).toHaveLength(1);
  });

  it('appends cursor predicate when cursor is provided', async () => {
    const { service, clickhouse } = makeService([]);
    const cursor = encodeCursor({ time: '2026-05-20 12:00:00', id: '999' });
    await service.queryEvents({ q: '', cursor });
    const sql: string = clickhouse.runQuery.mock.calls[0][0];
    expect(sql).toContain("(time, events_logs_id) < ('2026-05-20 12:00:00', 999)");
  });

  it('clamps limit into [1, 200]', async () => {
    const { service, clickhouse } = makeService([]);
    await service.queryEvents({ q: '', limit: 9999 });
    expect(clickhouse.runQuery.mock.calls[0][0]).toMatch(/LIMIT 201/);
    await service.queryEvents({ q: '', limit: 1 });
    expect(clickhouse.runQuery.mock.calls[1][0]).toMatch(/LIMIT 2/);
  });
});
