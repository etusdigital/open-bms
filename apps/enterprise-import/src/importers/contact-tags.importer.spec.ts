import { ContactTagsImporter } from './contact-tags.importer';
import { ImportContext } from './importer.interface';

// FakeRepo for the contacts_tags join table: supports find({where}) and
// createQueryBuilder().insert().values().execute() (the subset the importer uses).
class FakeJoinRepo {
  rows: Array<{ contactId: number; tagId: number; accountId: number }> = [];
  find({ where }: any) {
    const w = Array.isArray(where) ? where[0] : where;
    return Promise.resolve(this.rows.filter((r) => Object.entries(w).every(([k, v]: any) => (v?._type === 'in' ? v._value.includes((r as any)[k]) : (r as any)[k] === v))));
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
        for (const v of vals) this.rows.push({ ...v });
      },
    };
    return qb;
  }
}

// Patch TypeORM's In() with a FakeRepo-compatible matcher (entity import resolves
// to the decorated class, harmless under this mock).
jest.mock('typeorm', () => ({
  In: (arr: any[]) => ({ _type: 'in', _value: arr }),
  Entity: () => () => {},
  PrimaryColumn: () => () => {},
}));

function makeCtx(
  repo: FakeJoinRepo,
  scope: 'account' | 'instance',
  pages: any[],
  idMap: Record<string, Record<string, string>>,
  overrides: Partial<ImportContext> = {},
): ImportContext {
  return {
    jobId: 'job-1',
    accountId: 99,
    scope,
    client: {
      listContacts: jest.fn(async () => pages.shift() ?? { results: [], page: 1 }),
    } as any,
    idMapper: {
      // scope=instance returns the source id unchanged; account looks up the map.
      resolve: jest.fn((_j, sc, entity, srcId) => (sc === 'instance' ? String(srcId) : (idMap[entity]?.[String(srcId)] ?? null))),
    } as any,
    dataSource: {
      transaction: async (fn: any) => fn({ getRepository: () => repo }),
    } as any,
    checkpoint: {},
    updateProgress: jest.fn(async () => {}),
    setCheckpoint: jest.fn(async () => {}),
    ...overrides,
  };
}

describe('ContactTagsImporter', () => {
  it('account-scope: remaps contact_id and tag_id from the embedded tags map', async () => {
    const repo = new FakeJoinRepo();
    const imp = new ContactTagsImporter();
    const pages = [
      {
        results: [
          { id: 10, tags: { '100': { id: 100 }, '200': { id: 200 } } },
          { id: 20, tags: { '100': { id: 100 } } },
        ],
        page: 1,
      },
    ];
    const idMap = { contacts: { '10': '1', '20': '2' }, tags: { '100': '5', '200': '6' } };

    await imp.run(makeCtx(repo, 'account', pages, idMap));

    expect(repo.rows).toEqual([
      { contactId: 1, tagId: 5, accountId: 99 },
      { contactId: 1, tagId: 6, accountId: 99 },
      { contactId: 2, tagId: 5, accountId: 99 },
    ]);
  });

  it('account-scope: skips a link when either side is not mapped (no orphan FK)', async () => {
    const repo = new FakeJoinRepo();
    const imp = new ContactTagsImporter();
    const pages = [{ results: [{ id: 10, tags: { '100': {}, '999': {} } }], page: 1 }];
    const idMap = { contacts: { '10': '1' }, tags: { '100': '5' } }; // tag 999 unmapped

    await imp.run(makeCtx(repo, 'account', pages, idMap));

    expect(repo.rows).toEqual([{ contactId: 1, tagId: 5, accountId: 99 }]);
  });

  it('instance-scope: preserves source ids', async () => {
    const repo = new FakeJoinRepo();
    const imp = new ContactTagsImporter();
    const pages = [{ results: [{ id: 42, tags: { '7': {} } }], page: 1 }];

    await imp.run(makeCtx(repo, 'instance', pages, {}));

    expect(repo.rows).toEqual([{ contactId: 42, tagId: 7, accountId: 99 }]);
  });

  it('is idempotent: pre-existing pairs are not re-inserted', async () => {
    const repo = new FakeJoinRepo();
    repo.rows.push({ contactId: 1, tagId: 5, accountId: 99 });
    const imp = new ContactTagsImporter();
    const pages = [{ results: [{ id: 10, tags: { '100': {}, '200': {} } }], page: 1 }];
    const idMap = { contacts: { '10': '1' }, tags: { '100': '5', '200': '6' } };

    await imp.run(makeCtx(repo, 'account', pages, idMap));

    expect(repo.rows).toEqual([
      { contactId: 1, tagId: 5, accountId: 99 }, // preexisting, untouched
      { contactId: 1, tagId: 6, accountId: 99 }, // only the new pair inserted
    ]);
  });

  it('no links found emits terminal skipped:empty', async () => {
    const repo = new FakeJoinRepo();
    const imp = new ContactTagsImporter();
    const pages = [{ results: [{ id: 10 }], page: 1 }]; // contact without tags
    const ctx = makeCtx(repo, 'account', pages, { contacts: { '10': '1' }, tags: {} });

    await imp.run(ctx);

    expect(ctx.updateProgress).toHaveBeenCalledWith('contact_tags', { skipped: true, reason: 'empty' });
  });

  it('skips entirely when accountId is null', async () => {
    const repo = new FakeJoinRepo();
    const imp = new ContactTagsImporter();
    const ctx = makeCtx(repo, 'account', [], {}, { accountId: null });

    await imp.run(ctx);

    expect(ctx.updateProgress).toHaveBeenCalledWith('contact_tags', { skipped: true, reason: 'no_account_id' });
    expect(ctx.client.listContacts).not.toHaveBeenCalled();
  });
});
