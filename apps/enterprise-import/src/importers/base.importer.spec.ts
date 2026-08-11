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
    private defaults: Record<string, any> = {},
  ) {}
  get metadata() {
    return {
      columns: this.cols.map((propertyName) => ({ propertyName, databaseName: this.dbNames[propertyName] ?? propertyName, default: this.defaults[propertyName] })),
      primaryColumns: [{ propertyName: this.pk }],
      tableName: 'tags',
    };
  }
  find({ where }: any) {
    const w = Array.isArray(where) ? where[0] : where;
    return Promise.resolve(this.rows.filter((r) => Object.entries(w).every(([k, v]: any) => (v?._type === 'in' ? v._value.includes(r[k]) : r[k] === v))));
  }
  async count(opts: any) {
    return (await this.find(opts)).length;
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

    expect(ctx.updateProgress).toHaveBeenCalledWith('tags', { total: 1, done: 1, page: 1, seen: 1 });
  });

  it('account-scope: a null source value never reaches the INSERT as an explicit NULL', async () => {
    // Enterprise serializes legacy-nullable columns (e.g. testab_sent_after_test)
    // as null; copying that null verbatim would write an explicit NULL and trip a
    // NOT NULL constraint. Without a declared default the key is simply omitted.
    const repo = new FakeRepo(['id', 'accountId', 'name', 'flag']);
    const imp = new TestImporter();
    imp.pages = [{ results: [{ id: 1, name: 'x', flag: null, missing: undefined }], page: 1 }];

    await imp.run(makeCtx(repo, 'account'));

    expect(repo.rows).toHaveLength(1);
    expect('flag' in repo.rows[0]).toBe(false); // omitted, never an explicit NULL
  });

  it('account-scope: fills the entity-declared default for a null source value (legacy-safe, no reliance on the DB DEFAULT)', async () => {
    // flag declares default=false. A null/absent source value must be written as
    // the default at the application layer, so the INSERT works even on a legacy
    // target whose column lacks the DB-level DEFAULT.
    const repo = new FakeRepo(['id', 'accountId', 'name', 'flag'], 'id', {}, { flag: false });
    const imp = new TestImporter();
    imp.pages = [{ results: [{ id: 1, name: 'x', flag: null }], page: 1 }];

    await imp.run(makeCtx(repo, 'account'));

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].flag).toBe(false); // default applied explicitly, not omitted
  });

  it('account-scope upsert: a null source value does NOT overwrite an existing value with the default', async () => {
    // Re-import where the source dropped the field: the existing row must keep its
    // value (defaults are insert-only, never part of the update patch).
    const repo = new FakeRepo(['id', 'accountId', 'name', 'flag'], 'id', {}, { flag: false });
    repo.rows.push({ id: 1, accountId: 99, name: 'x', flag: true });
    const imp = new TestImporter();
    imp.pages = [{ results: [{ id: 1, name: 'x', flag: null }], page: 1 }];

    await imp.run(makeCtx(repo, 'account'));

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].flag).toBe(true); // preserved, not reset to the default
  });

  it('instance-scope: fills the entity-declared default for a null source value', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name', 'flag'], 'id', {}, { flag: false });
    const imp = new TestImporter();
    imp.pages = [{ results: [{ id: 7, name: 'x', flag: null }], page: 1 }];

    await imp.run(makeCtx(repo, 'instance'));

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].flag).toBe(false); // default reaches the raw INSERT
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

describe('BaseImporter — contador de descartes', () => {
  class ImporterComFk extends TestImporter {
    protected readonly fkRemap = { ownerId: 'owners' };
  }
  class ImporterQueRecusa extends TestImporter {
    protected async customize(_ctx: any, _src: any, mapped: any) {
      return mapped.name === 'recusada' ? null : mapped;
    }
  }

  function ultimoProgresso(ctx: ImportContext) {
    const chamadas = (ctx.updateProgress as jest.Mock).mock.calls;
    return chamadas[chamadas.length - 1][1];
  }

  it('conta a linha que o customize() recusa', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp = new ImporterQueRecusa();
    imp.pages = [
      {
        results: [
          { id: 1, name: 'ok' },
          { id: 2, name: 'recusada' },
        ],
        page: 1,
      },
    ];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(ultimoProgresso(ctx).discarded).toMatchObject({ mapper_rejected: 1, fk_unresolved: 0 });
    expect(ultimoProgresso(ctx).seen).toBe(2);
    expect(repo.rows).toHaveLength(1);
  });

  it('conta a linha cuja FK não resolveu em scope=account', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name', 'ownerId']);
    const imp = new ImporterComFk();
    imp.pages = [{ results: [{ id: 1, name: 'a', ownerId: 55 }], page: 1 }];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    // Separado do customize: FK não resolvida aponta para um passo pai que não
    // importou, não para uma decisão de qualidade de dado sobre esta linha.
    expect(ultimoProgresso(ctx).discarded).toMatchObject({ fk_unresolved: 1, mapper_rejected: 0 });
    expect(repo.rows).toHaveLength(0);
  });

  it('conta a linha sem chave natural', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp = new TestImporter();
    imp.pages = [
      {
        results: [
          { id: 1, name: 'a' },
          { id: 2, name: '' },
        ],
        page: 1,
      },
    ];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(ultimoProgresso(ctx).discarded).toMatchObject({ empty_natural_key: 1 });
  });

  it('conta a linha repetida dentro da mesma página', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp = new TestImporter();
    imp.pages = [
      {
        results: [
          { id: 1, name: 'a' },
          { id: 2, name: 'a' },
        ],
        page: 1,
      },
    ];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(ultimoProgresso(ctx).discarded).toMatchObject({ duplicate_in_page: 1 });
    expect(repo.rows).toHaveLength(1);
  });

  it('conta a linha que o ON CONFLICT engoliu no insert', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name', 'email']);
    const emailsUsados = new Set<string>();
    const inserirOriginal = repo.createQueryBuilder.bind(repo);
    jest.spyOn(repo, 'createQueryBuilder').mockImplementation(() => {
      const qb = inserirOriginal();
      const executeOriginal = qb.execute;
      qb.values = ((v: any) => {
        const linhas = (Array.isArray(v) ? v : [v]).filter((r: any) => {
          if (emailsUsados.has(r.email)) return false; // conflito engolido
          emailsUsados.add(r.email);
          return true;
        });
        executeOriginal.call(qb);
        return Object.assign(qb, {
          execute: async () => {
            for (const r of linhas) repo.rows.push({ ...r, id: repo.rows.length + 1 });
          },
        });
      }) as any;
      return qb;
    });

    const imp = new TestImporter();
    imp.pages = [
      {
        results: [
          { id: 1, name: 'a', email: 'x@y.com' },
          { id: 2, name: 'b', email: 'x@y.com' },
        ],
        page: 1,
      },
    ];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(ultimoProgresso(ctx).discarded).toMatchObject({ insert_conflict: 1 });
    expect(ultimoProgresso(ctx).done).toBe(1); // done conta linhas gravadas, não candidatas
    expect(repo.rows).toHaveLength(1);
  });

  it('quando TODAS as candidatas da página perdem para o conflito de índice único, o passo fecha em all_discarded, não em done', async () => {
    // Simula uma página inteira colidindo contra um índice único já ocupado
    // (nenhuma das duas linhas é pré-existente pela natural key do importer —
    // o conflito é noutro índice, como email — então orIgnore() engole as duas).
    const repo = new FakeRepo(['id', 'accountId', 'name', 'email']);
    repo.rows.push({ id: 999, accountId: 99, name: 'já existe', email: 'colide@y.com' });
    jest.spyOn(repo, 'createQueryBuilder').mockImplementation(() => ({
      insert: () => ({ values: () => ({ updateEntity: () => ({ orIgnore: () => ({ execute: async () => {} }) }) }) }),
    }));

    const imp = new TestImporter();
    imp.pages = [
      {
        results: [
          { id: 1, name: 'a', email: 'colide@y.com' },
          { id: 2, name: 'b', email: 'colide@y.com' },
        ],
        page: 1,
      },
    ];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(repo.rows).toHaveLength(1); // só a linha pré-existente
    expect(ultimoProgresso(ctx)).toMatchObject({ skipped: true, reason: 'all_discarded', seen: 2 });
    expect(ultimoProgresso(ctx).discarded).toMatchObject({ insert_conflict: 2 });
  });

  it('não emite o bloco de descartes quando nada foi descartado', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp = new TestImporter();
    imp.pages = [{ results: [{ id: 1, name: 'a' }], page: 1 }];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(ultimoProgresso(ctx).discarded).toBeUndefined();
    expect(ultimoProgresso(ctx).seen).toBe(1);
  });

  it('uma importação que leu linhas e não gravou nenhuma não é "empty"', async () => {
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp = new ImporterQueRecusa();
    imp.pages = [{ results: [{ id: 1, name: 'recusada' }], page: 1 }];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(ultimoProgresso(ctx)).toMatchObject({ skipped: true, reason: 'all_discarded', seen: 1 });
  });

  it('all_discarded vale mesmo quando a origem informa o total', async () => {
    // Com totalItems presente, fechar o passo em done=total marcaria como
    // importado por inteiro um passo que não gravou nada.
    const repo = new FakeRepo(['id', 'accountId', 'name']);
    const imp = new ImporterQueRecusa();
    imp.pages = [{ results: [{ id: 1, name: 'recusada' }], page: 1, totalItems: 1 }];
    const ctx = makeCtx(repo, 'account');

    await imp.run(ctx);

    expect(repo.rows).toHaveLength(0);
    expect(ultimoProgresso(ctx)).toMatchObject({ skipped: true, reason: 'all_discarded' });
    expect(ultimoProgresso(ctx).done).toBeUndefined();
  });
});
