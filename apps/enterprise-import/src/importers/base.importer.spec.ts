import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';

// DB em memória mínimo que imita o subset de Repository usado pelo BaseImporter:
// metadata.columns/primaryColumns, find({where}), createQueryBuilder().insert().
class FakeRepo {
  rows: any[] = [];
  private seq = 1;
  constructor(
    private cols: string[],
    private pk = 'id',
  ) {}
  get metadata() {
    return {
      columns: this.cols.map((propertyName) => ({ propertyName, databaseName: propertyName })),
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
    enterpriseSourceAccountId: 7,
    scope,
    client: {} as any,
    idMapper: {
      record: jest.fn(async (_j, _e, src, nid) => {
        recorded.push({ src, nid });
      }),
      resolve: jest.fn(() => null),
      // expõe pro teste
      _recorded: recorded,
    } as any,
    dataSource: {
      getRepository: () => repo,
      // em do tx: getRepository + query (instance-scope usa rawInsertPreservingPk).
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

// patch In() do TypeORM usado dentro do BaseImporter: o módulo importa { In }
// de 'typeorm'; substituímos por nosso matcher compatível com o FakeRepo.
jest.mock('typeorm', () => ({
  In: (arr: any[]) => ({ _type: 'in', _value: arr }),
}));

describe('BaseImporter (rewrite F1/F3/F4/F8)', () => {
  it('account-scope: descarta id, insere por chave natural e mapeia src→newId NÃO posicional', async () => {
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
    // ids reescritos pela sequence (não os 500/400 do Enterprise)
    expect(repo.rows.every((r) => r.id < 100)).toBe(true);
    expect(repo.rows.every((r) => r.accountId === 99)).toBe(true);
    // mapping liga pela CHAVE NATURAL: src 500/'b' → id do 'b'; 400/'a' → 'a'
    const rec = (ctx.idMapper as any)._recorded as Array<{ src: any; nid: any }>;
    const bySrc = new Map(rec.map((r) => [r.src, r.nid]));
    expect(bySrc.get(500)).toBe(repo.rows.find((r) => r.name === 'b').id);
    expect(bySrc.get(400)).toBe(repo.rows.find((r) => r.name === 'a').id);
  });

  it('é idempotente: reprocessar a mesma página não duplica (F8)', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp1 = new TestImporter();
    imp1.pages = [{ results: [{ id: 1, name: 'x' }], page: 1 }];
    await imp1.run(makeCtx(repo, 'account'));
    expect(repo.rows).toHaveLength(1);

    const imp2 = new TestImporter();
    imp2.pages = [{ results: [{ id: 1, name: 'x' }], page: 1 }];
    await imp2.run(makeCtx(repo, 'account'));
    expect(repo.rows).toHaveLength(1); // sem duplicata
  });

  it('instance-scope: preserva o id de origem e NÃO grava mapping', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp = new TestImporter();
    imp.pages = [{ results: [{ id: 42, name: 'keep' }], page: 1 }];
    const ctx = makeCtx(repo, 'instance');

    await imp.run(ctx);

    expect(repo.rows[0].id).toBe(42);
    expect((ctx.idMapper as any)._recorded).toHaveLength(0);
  });
});
