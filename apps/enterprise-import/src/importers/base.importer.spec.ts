import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';

// Minimal in-memory DB mimicking the Repository subset BaseImporter uses:
// metadata.columns/primaryColumns, find({where}), createQueryBuilder().insert().
class FakeRepo {
  rows: any[] = [];
  private seq = 1;
  constructor(
    private cols: string[],
    private pk = 'id',
    private dbNames: Record<string, string> = {},
  ) {}
  get metadata() {
    return {
      columns: this.cols.map((propertyName) => ({ propertyName, databaseName: this.dbNames[propertyName] ?? propertyName })),
      primaryColumns: [{ propertyName: this.pk }],
      tableName: 'tags',
    };
  }
  find({ where }: any) {
    const w = Array.isArray(where) ? where[0] : where;
    return Promise.resolve(this.rows.filter((r) => Object.entries(w).every(([k, v]: any) => (v?._type === 'in' ? v._value.includes(r[k]) : r[k] === v))));
  }
  createQueryBuilder() {
    let vals: any[] = [];
    const qb: any = {
      insert: () => qb,
      values: (v: any) => {
        vals = Array.isArray(v) ? v : [v];
        return qb;
      },
      updateEntity: () => qb,
      orIgnore: () => qb,
      execute: async () => {
        for (const v of vals) {
          const row = { ...v };
          if (row[this.pk] === undefined) row[this.pk] = this.seq++;
          this.rows.push(row);
        }
      },
    };
    return qb;
  }
  update(criteria: any, patch: any) {
    for (const row of this.rows) {
      if (Object.entries(criteria).every(([k, v]) => row[k] === v)) Object.assign(row, patch);
    }
    return Promise.resolve();
  }
}

class TestImporter extends BaseImporter<any> {
  readonly name = 'tags';
  protected readonly entity = class {} as any;
  protected readonly batchSize = 100;
  protected readonly naturalKey = ['name'];
  pages: PagedResponse<any>[] = [];
  protected fetchPage(): Promise<PagedResponse<any>> {
    return Promise.resolve(this.pages.shift() ?? { results: [], page: 1 });
  }
}

function makeCtx(repo: FakeRepo, scope: 'account' | 'instance', overrides: Partial<ImportContext> = {}): ImportContext {
  const recorded: Array<{ src: any; nid: any }> = [];
  return {
    jobId: 'job-1',
    accountId: 99,
    scope,
    client: {} as any,
    idMapper: {
      record: jest.fn(async (_j, _e, src, nid) => {
        recorded.push({ src, nid });
      }),
      resolve: jest.fn(() => null),
      // exposed for assertions
      _recorded: recorded,
    } as any,
    dataSource: {
      getRepository: () => repo,
      // tx exposes getRepository + query (instance-scope uses rawInsertPreservingPk).
      transaction: async (fn: any) =>
        fn({
          getRepository: () => repo,
          query: async (sql: string, params: any[] = []) => {
            const cols = sql
              .match(/\(([^)]+)\)\s+VALUES/i)![1]
              .split(',')
              .map((s) => s.trim().replace(/"/g, ''));
            for (let i = 0; i < params.length; i += cols.length) {
              const row: any = {};
              cols.forEach((c, j) => (row[c] = params[i + j]));
              repo.rows.push(row);
            }
          },
        }),
    } as any,
    checkpoint: {},
    updateProgress: jest.fn(async () => {}),
    setCheckpoint: jest.fn(async () => {}),
    ...overrides,
  };
}

// Patch TypeORM's In() used inside BaseImporter with a FakeRepo-compatible matcher.
jest.mock('typeorm', () => ({
  In: (arr: any[]) => ({ _type: 'in', _value: arr }),
}));

describe('BaseImporter', () => {
  it('account-scope: discards source id, inserts by natural key, maps src→newId non-positionally', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp = new TestImporter();
    imp.pages = [
      {
        results: [
          { id: 500, name: 'b' },
          { id: 400, name: 'a' },
        ],
        page: 1,
      },
    ];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(repo.rows).toHaveLength(2);
    // ids rewritten by the sequence (not Enterprise's 500/400)
    expect(repo.rows.every((r) => r.id < 100)).toBe(true);
    expect(repo.rows.every((r) => r.accountId === 99)).toBe(true);
    // mapping links by natural key: src 500/'b' → id of 'b'; 400/'a' → 'a'
    const rec = (ctx.idMapper as any)._recorded as Array<{ src: any; nid: any }>;
    const bySrc = new Map(rec.map((r) => [r.src, r.nid]));
    expect(bySrc.get(500)).toBe(repo.rows.find((r) => r.name === 'b').id);
    expect(bySrc.get(400)).toBe(repo.rows.find((r) => r.name === 'a').id);
  });

  it('maps snake_case source keys (databaseName) onto camelCase columns', async () => {
    // The /contacts list serializes raw snake_case; ensure those land in their
    // columns instead of being dropped (the firstName/lastName regression).
    const repo = new FakeRepo(['id', 'accountId', 'name', 'firstName'], 'id', { accountId: 'account_id', firstName: 'first_name' });
    const imp = new TestImporter();
    imp.pages = [{ results: [{ id: 1, account_id: 7, name: 'x', first_name: 'Ana' }], page: 1 }];

    await imp.run(makeCtx(repo, 'account'));

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].firstName).toBe('Ana'); // snake_case first_name -> firstName
    expect(repo.rows[0].accountId).toBe(99); // still forced to the ctx account
  });

  it('account-scope upsert: re-importing an existing row updates its columns (no duplicate)', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name', 'extra']);
    const imp1 = new TestImporter();
    imp1.pages = [{ results: [{ id: 1, name: 'x', extra: 'A' }], page: 1 }];
    await imp1.run(makeCtx(repo, 'account'));
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].extra).toBe('A');

    const imp2 = new TestImporter();
    imp2.pages = [{ results: [{ id: 1, name: 'x', extra: 'B' }], page: 1 }];
    await imp2.run(makeCtx(repo, 'account'));
    expect(repo.rows).toHaveLength(1); // matched by natural key, not duplicated
    expect(repo.rows[0].extra).toBe('B'); // refreshed from source
  });

  it('is idempotent: reprocessing the same page does not duplicate', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp1 = new TestImporter();
    imp1.pages = [{ results: [{ id: 1, name: 'x' }], page: 1 }];
    await imp1.run(makeCtx(repo, 'account'));
    expect(repo.rows).toHaveLength(1);

    const imp2 = new TestImporter();
    imp2.pages = [{ results: [{ id: 1, name: 'x' }], page: 1 }];
    await imp2.run(makeCtx(repo, 'account'));
    expect(repo.rows).toHaveLength(1); // no duplicate
  });

  it('empty source (or tolerated 404) emits terminal state skipped:empty instead of staying pending forever', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp = new TestImporter();
    imp.pages = []; // fetchPage returns { results: [], page: 1 }
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(ctx.updateProgress).toHaveBeenCalledWith('tags', { skipped: true, reason: 'empty' });
  });

  it('resume: everything already existed (0 new, totalItems>0) closes at 100% (done=total)', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    repo.rows.push({ id: 1, accountId: 99, name: 'x' }); // already exists → 0 inserts
    const imp = new TestImporter();
    imp.pages = [{ results: [{ id: 1, name: 'x' }], page: 1, totalItems: 1 }];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(ctx.updateProgress).toHaveBeenCalledWith('tags', { total: 1, done: 1, page: 1 });
  });

  it('instance-scope: preserves the source id and does not write a mapping', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp = new TestImporter();
    imp.pages = [{ results: [{ id: 42, name: 'keep' }], page: 1 }];
    const ctx = makeCtx(repo, 'instance');

    await imp.run(ctx);

    expect(repo.rows[0].id).toBe(42);
    expect((ctx.idMapper as any)._recorded).toHaveLength(0);
  });
});
