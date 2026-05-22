import { ContactCustomFieldsImporter } from './contact-custom-fields.importer';
import { ImportContext } from './importer.interface';

// FakeRepo for contacts_custom_fields: find({where}) + insert via QB.
class FakeRepo {
  rows: Array<{ contactId: number; customFieldId: number; accountId: number; value: string; time: Date | null; number: number | null }> = [];
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
  update(criteria: any, patch: any) {
    for (const row of this.rows) {
      if (Object.entries(criteria).every(([k, v]) => (row as any)[k] === v)) Object.assign(row, patch);
    }
    return Promise.resolve();
  }
}

jest.mock('typeorm', () => ({
  In: (arr: any[]) => ({ _type: 'in', _value: arr }),
  Entity: () => () => {},
  PrimaryColumn: () => () => {},
  Column: () => () => {},
}));

function makeCtx(
  repo: FakeRepo,
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
      listContactCustomFields: jest.fn(async () => pages.shift() ?? { results: [], page: 1 }),
    } as any,
    idMapper: {
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

describe('ContactCustomFieldsImporter', () => {
  it('account-scope: remaps contact_id and custom_field_id, carries value/time/number', async () => {
    const repo = new FakeRepo();
    const imp = new ContactCustomFieldsImporter();
    const pages = [
      {
        results: [
          { contactId: 10, customFieldId: 100, value: 'A', time: null, number: 5 },
          { contactId: 20, customFieldId: 100, value: 'B', time: null, number: null },
        ],
        page: 1,
      },
    ];
    const idMap = { contacts: { '10': '1', '20': '2' }, 'custom-fields': { '100': '500' } };

    await imp.run(makeCtx(repo, 'account', pages, idMap));

    expect(repo.rows).toEqual([
      { contactId: 1, customFieldId: 500, value: 'A', time: null, number: 5, accountId: 99 },
      { contactId: 2, customFieldId: 500, value: 'B', time: null, number: null, accountId: 99 },
    ]);
  });

  it('account-scope: skips a row when contact or field is not mapped', async () => {
    const repo = new FakeRepo();
    const imp = new ContactCustomFieldsImporter();
    const pages = [
      {
        results: [
          { contactId: 10, customFieldId: 100, value: 'ok' },
          { contactId: 10, customFieldId: 999, value: 'orphan-field' },
          { contactId: 88, customFieldId: 100, value: 'orphan-contact' },
        ],
        page: 1,
      },
    ];
    const idMap = { contacts: { '10': '1' }, 'custom-fields': { '100': '500' } };

    await imp.run(makeCtx(repo, 'account', pages, idMap));

    expect(repo.rows).toEqual([{ contactId: 1, customFieldId: 500, value: 'ok', time: null, number: null, accountId: 99 }]);
  });

  it('value defaults to empty string when source value is null (NOT NULL column)', async () => {
    const repo = new FakeRepo();
    const imp = new ContactCustomFieldsImporter();
    const pages = [{ results: [{ contactId: 10, customFieldId: 100, value: null }], page: 1 }];
    const idMap = { contacts: { '10': '1' }, 'custom-fields': { '100': '500' } };

    await imp.run(makeCtx(repo, 'account', pages, idMap));

    expect(repo.rows[0].value).toBe('');
  });

  it('instance-scope: preserves source ids', async () => {
    const repo = new FakeRepo();
    const imp = new ContactCustomFieldsImporter();
    const pages = [{ results: [{ contactId: 42, customFieldId: 7, value: 'x' }], page: 1 }];

    await imp.run(makeCtx(repo, 'instance', pages, {}));

    expect(repo.rows).toEqual([{ contactId: 42, customFieldId: 7, value: 'x', time: null, number: null, accountId: 99 }]);
  });

  it('upsert: pre-existing pairs are updated (not duplicated), new ones inserted', async () => {
    const repo = new FakeRepo();
    repo.rows.push({ contactId: 1, customFieldId: 500, accountId: 99, value: 'old', time: null, number: null });
    const imp = new ContactCustomFieldsImporter();
    const pages = [
      {
        results: [
          { contactId: 10, customFieldId: 100, value: 'refreshed' },
          { contactId: 10, customFieldId: 200, value: 'fresh' },
        ],
        page: 1,
      },
    ];
    const idMap = { contacts: { '10': '1' }, 'custom-fields': { '100': '500', '200': '600' } };

    await imp.run(makeCtx(repo, 'account', pages, idMap));

    // existing (1,500) refreshed in place (value 'old' -> 'refreshed'), no dup;
    // (1,600) inserted new.
    expect(repo.rows).toEqual([
      { contactId: 1, customFieldId: 500, accountId: 99, value: 'refreshed', time: null, number: null },
      { contactId: 1, customFieldId: 600, value: 'fresh', time: null, number: null, accountId: 99 },
    ]);
  });

  it('no rows emits terminal skipped:empty', async () => {
    const repo = new FakeRepo();
    const imp = new ContactCustomFieldsImporter();
    const ctx = makeCtx(repo, 'account', [{ results: [{ contactId: 10, customFieldId: 100 }], page: 1 }], { contacts: {}, 'custom-fields': {} });

    await imp.run(ctx);

    expect(ctx.updateProgress).toHaveBeenCalledWith('contact_custom_fields', { skipped: true, reason: 'empty' });
  });

  it('endpoint absent (404 -> empty page via tolerate404): skips without throwing', async () => {
    const repo = new FakeRepo();
    const imp = new ContactCustomFieldsImporter();
    // tolerate404 in the client turns a missing endpoint into an empty page.
    const ctx = makeCtx(repo, 'account', [{ results: [], page: 1 }], {});

    await expect(imp.run(ctx)).resolves.toBeUndefined();

    expect(repo.rows).toHaveLength(0);
    expect(ctx.updateProgress).toHaveBeenCalledWith('contact_custom_fields', { skipped: true, reason: 'empty' });
  });

  it('skips entirely when accountId is null', async () => {
    const repo = new FakeRepo();
    const imp = new ContactCustomFieldsImporter();
    const ctx = makeCtx(repo, 'account', [], {}, { accountId: null });

    await imp.run(ctx);

    expect(ctx.updateProgress).toHaveBeenCalledWith('contact_custom_fields', { skipped: true, reason: 'no_account_id' });
    expect(ctx.client.listContactCustomFields).not.toHaveBeenCalled();
  });
});
