/**
 * Real integration tests.
 *
 * Starts an ephemeral Postgres (testcontainers), builds the schema from the
 * real entity metadata, stands up an HTTP mock of the Enterprise msgops-api,
 * and runs the real importer end-to-end. Validates all columns persisted,
 * natural-key resolution, FK/accountId handling, resume idempotency, and the
 * EnterpriseClient 4xx short-circuit.
 *
 * Requires Docker. Off by default in CI:
 *   ENABLE_INTEGRATION_TESTS=true pnpm --filter enterprise-import test -- test/integration
 */
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Loads all msgops-api entity classes dynamically (ts-jest transforms the .ts
// requires). The full relation closure is needed for complete metadata.
type EntityClass = new (...args: any[]) => unknown;
const ENTITIES_DIR = join(__dirname, '../src/entities');
function loadAllEntities(): EntityClass[] {
  const out: EntityClass[] = [];
  for (const f of readdirSync(ENTITIES_DIR)) {
    if (!f.endsWith('.entity.ts')) continue;
    const mod = require(join(ENTITIES_DIR, f));
    for (const v of Object.values(mod)) {
      if (typeof v === 'function' && /Entity$/.test((v as { name: string }).name)) out.push(v as EntityClass);
    }
  }
  return out;
}

// synchronize:true breaks on the legacy schema's duplicate FKs (known TypeORM
// bug; prod uses migrations). The DDL for the tables under test is generated
// from the real metadata (authentic columns, no FKs — not needed by the importer).
function pgType(col: any): string {
  const t = typeof col.type === 'function' ? col.type.name.toLowerCase() : String(col.type).toLowerCase();
  if (col.isGenerated && col.generationStrategy === 'uuid') return 'uuid';
  if (col.isPrimary && col.isGenerated) return 'serial';
  if (['int', 'integer', 'number', 'smallint'].includes(t)) return 'integer';
  if (['bigint'].includes(t)) return 'bigint';
  if (['decimal', 'numeric'].includes(t)) return 'numeric';
  if (['boolean', 'bool'].includes(t)) return 'boolean';
  if (['jsonb'].includes(t)) return 'jsonb';
  if (['json'].includes(t)) return 'json';
  if (['date'].includes(t)) return 'date';
  if (['timestamp', 'timestamptz', 'timestamp with time zone', 'datetime'].includes(t)) return 'timestamptz';
  if (['text'].includes(t)) return 'text';
  return `varchar(${col.length || 255})`;
}
async function createTableFromMetadata(ds: DataSource, entity: EntityClass): Promise<void> {
  const meta = ds.getMetadata(entity);
  const pkCols = meta.columns.filter((c: any) => c.isPrimary);
  const cols = meta.columns.map((c: any) => {
    const parts = [`"${c.databaseName}"`, pgType(c)];
    if (c.isPrimary && c.isGenerated && c.generationStrategy === 'uuid') parts.push('DEFAULT gen_random_uuid()');
    if (!c.isNullable && !c.isPrimary) parts.push('NOT NULL');
    if (c.default !== undefined && typeof c.default !== 'function') {
      const d = typeof c.default === 'string' && !/^[0-9]/.test(c.default) ? `'${c.default}'` : c.default;
      parts.push(`DEFAULT ${d}`);
    } else if (['created_at', 'updated_at'].includes(c.databaseName)) {
      parts.push('DEFAULT now()');
    }
    return parts.join(' ');
  });
  const pk = pkCols.length ? `, PRIMARY KEY (${pkCols.map((c: any) => `"${c.databaseName}"`).join(', ')})` : '';
  await ds.query(`CREATE TABLE IF NOT EXISTS "${meta.tableName}" (${cols.join(', ')}${pk})`);
}

import { EnterpriseClient } from '../src/enterprise-client/enterprise.client';
import { EnterpriseApi4xxError } from '../src/enterprise-client/errors';
import { IdMapperService } from '../src/id-mapper.service';
import { TagsImporter } from '../src/importers/tags.importer';
import { ContactTagsImporter } from '../src/importers/contact-tags.importer';
import { ContactTagEntity } from '../src/entities/contact-tag.entity';
import { ContactCustomFieldsImporter } from '../src/importers/contact-custom-fields.importer';
import { ContactCustomFieldEntity } from '../src/entities/contact-custom-field.entity';
import { CampaignsImporter } from '../src/importers/campaigns.importer';
import { CampaignEntity } from '../src/entities/campaign.entity';
import { ImportContext } from '../src/importers/importer.interface';

import { EnterpriseImportJobEntity } from '../src/entities/enterprise-import-job.entity';
import { EnterpriseIdMappingEntity } from '../src/entities/enterprise-id-mapping.entity';
import { AccountEntity } from '../src/entities/account.entity';
import { TagEntity } from '../src/entities/tag.entity';

const enabled = process.env.ENABLE_INTEGRATION_TESTS === 'true';
const d = enabled ? describe : describe.skip;

// Full Tag in the shape the Enterprise serializes, with every NOT NULL column
// filled. If the importer dropped columns, the INSERT would fail against the
// real DDL.
function makeTag(id: number, name: string) {
  return {
    id,
    accountId: 1,
    name,
    description: `desc ${name}`,
    type: 'static',
    recurrence: 0,
    scheduleCloudTaskId: '',
    steps: [],
    segmentInfo: {},
    contactsLimit: 0,
    lastCount: 0,
    lastCountEmail: 0,
    lastCountWebPush: 0,
    lastCountMobilePush: 0,
    lastCountPhone: 0,
    lastCountWhatsapp: 0,
    addBounced: false,
    addUnsubscribed: false,
    addInvalid: false,
    isRealTimeSegment: false,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// A campaign in the shape the Enterprise serializes. Every NOT NULL column is
// filled EXCEPT the ones that carry a column default (testabSentAfterTest,
// sendToAll, messageType): the Enterprise emits those legacy columns as null.
// Against the real DDL (NOT NULL DEFAULT ...), the importer must turn that null
// into the default instead of an explicit NULL — the EVO-1761 crash.
function makeCampaign(id: number, name: string) {
  const now = new Date().toISOString();
  return {
    id,
    accountId: 1,
    title: `Campaign ${name}`,
    description: `desc ${name}`,
    name,
    publisher: 'pub',
    scheduleTo: now,
    scheduleToCloudTaskId: '',
    status: 1,
    spreadSending: 0,
    sentContacts: 0,
    sentPercentage: 0,
    query: '',
    steps: [],
    tags: [],
    type: 'regular',
    messageType: null, // default 'email'
    sendToAll: null, // default false
    testabScheduleTo: now,
    testabScheduleEnd: now,
    testabAudiencePercent: 0,
    testabCriteria: '',
    testabSentAfterTest: null, // default false — the column that crashed the import
    testabLastId: 0,
    testabScheduleToCloudTaskId: '',
    testabScheduleEndCloudTaskId: '',
    recurrenceCount: 0,
    recurrenceSettings: {},
    isRateLimit: false,
    runSegment: false,
    triggers: [],
    createdAt: now,
    updatedAt: now,
  };
}

d('enterprise-import integration (testcontainers + Enterprise mock)', () => {
  jest.setTimeout(120_000);

  let pg: StartedPostgreSqlContainer;
  let ds: DataSource;
  let server: Server;
  let baseUrl: string;
  let mode: 'ok' | 'unauthorized' = 'ok';

  beforeAll(async () => {
    pg = await new PostgreSqlContainer('postgres:16-alpine').start();
    ds = new DataSource({
      type: 'postgres',
      url: pg.getConnectionUri(),
      entities: loadAllEntities(), // full closure for metadata
      synchronize: false,
    });
    await ds.initialize();
    // Create only the tables under test, from the real metadata.
    for (const e of [EnterpriseImportJobEntity, EnterpriseIdMappingEntity, AccountEntity, TagEntity, ContactTagEntity, ContactCustomFieldEntity, CampaignEntity]) {
      await createTableFromMetadata(ds, e);
    }

    server = createServer((req, res) => {
      if (req.headers['x-api-key'] !== 'good-key') {
        res.writeHead(401, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ message: 'unauthorized' }));
      }
      if (mode === 'unauthorized') {
        res.writeHead(401);
        return res.end('{}');
      }
      const url = new URL(req.url!, 'http://x');
      const page = Number(url.searchParams.get('page') || '1');
      if (url.pathname === '/tags') {
        const all = [makeTag(101, 'alpha'), makeTag(102, 'beta'), makeTag(103, 'gamma')];
        const results = page === 1 ? all : [];
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ results, page, totalItems: all.length }));
      }
      if (url.pathname === '/campaigns') {
        const all = [makeCampaign(201, 'promo'), makeCampaign(202, 'newsletter')];
        const results = page === 1 ? all : [];
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ results, page, totalItems: all.length }));
      }
      if (url.pathname === '/contacts/custom-fields/values') {
        // Bulk join feed: rows in SOURCE ids. Field 999 is unmapped on purpose.
        const all = [
          { contactId: 10, customFieldId: 100, value: 'Acme', time: null, number: null },
          { contactId: 10, customFieldId: 200, value: '42', time: null, number: 42 },
          { contactId: 20, customFieldId: 100, value: 'Globex', time: null, number: null },
          { contactId: 20, customFieldId: 999, value: 'dropped', time: null, number: null },
        ];
        const results = page === 1 ? all : [];
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ results, page }));
      }
      if (url.pathname === '/contacts') {
        // Mirrors findAllPaginated: each contact carries `tags`, an object
        // keyed by the SOURCE tag id (jsonb_object_agg). Contact 30 has none.
        const all = [{ id: 10, tags: { '101': { id: 101 }, '102': { id: 102 } } }, { id: 20, tags: { '101': { id: 101 } } }, { id: 30 }];
        const results = page === 1 ? all : [];
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ results, page }));
      }
      res.writeHead(404);
      res.end('{}');
    });
    await new Promise<void>((r) => server.listen(0, r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await ds?.destroy();
    await new Promise<void>((r) => server?.close(() => r()));
    await pg?.stop();
  });

  beforeEach(async () => {
    mode = 'ok';
    await ds.getRepository(TagEntity).clear();
    await ds.query('DELETE FROM contacts_tags');
    await ds.query('DELETE FROM contacts_custom_fields');
    await ds.query('DELETE FROM enterprise_id_mappings');
    await ds.query('DELETE FROM enterprise_import_jobs');
    await ds.query('DELETE FROM campaigns');
  });

  function ctx(scope: 'account' | 'instance', jobId: string): ImportContext {
    const idMapper = new IdMapperService(ds.getRepository(EnterpriseIdMappingEntity) as any);
    const session = new EnterpriseClient().createSession(baseUrl, 'good-key');
    return {
      jobId,
      accountId: 1,
      scope,
      client: session,
      idMapper,
      dataSource: ds,
      checkpoint: {},
      updateProgress: async () => {},
      setCheckpoint: async () => {},
    };
  }

  it('1. account-scope: persists all columns, overwrites accountId, maps src→newId by natural key', async () => {
    // The importer does not read enterprise_import_jobs (the processor does);
    // idMapper writes to enterprise_id_mappings.job_id (varchar). Any jobId works.
    await new TagsImporter().run(ctx('account', 'job-1'));

    const tags = await ds.getRepository(TagEntity).find({ order: { name: 'ASC' } });
    expect(tags.map((t) => t.name)).toEqual(['alpha', 'beta', 'gamma']);
    expect(tags.every((t) => t.accountId === 1)).toBe(true);
    expect(tags.every((t) => t.type === 'static' && t.status === 'active')).toBe(true);
    // ids rewritten by the sequence (not Enterprise's 101/102/103)
    expect(tags.every((t) => t.id < 100)).toBe(true);

    const maps = await ds.getRepository(EnterpriseIdMappingEntity).find();
    const bySource = new Map(maps.map((m) => [m.sourceId, m.newId]));
    const alpha = tags.find((t) => t.name === 'alpha')!;
    expect(bySource.get('101')).toBe(String(alpha.id)); // linked by natural key, not positionally
  });

  it('2. idempotent: running the same importer twice does not duplicate', async () => {
    await new TagsImporter().run(ctx('account', 'j2'));
    await new TagsImporter().run(ctx('account', 'j2'));
    const count = await ds.getRepository(TagEntity).count();
    expect(count).toBe(3);
  });

  it('3. instance-scope: preserves the source id and does not write a mapping', async () => {
    await new TagsImporter().run(ctx('instance', 'j3'));
    const ids = (await ds.getRepository(TagEntity).find()).map((t) => t.id).sort();
    expect(ids).toEqual([101, 102, 103]);
    expect(await ds.getRepository(EnterpriseIdMappingEntity).count()).toBe(0);
  });

  it('4. Enterprise 4xx throws EnterpriseApi4xxError without retry', async () => {
    mode = 'unauthorized';
    await expect(new TagsImporter().run(ctx('account', 'j4'))).rejects.toBeInstanceOf(EnterpriseApi4xxError);
  });

  it('5. contact_tags account-scope: remaps contact_id/tag_id from the embedded tags map', async () => {
    const c = ctx('account', 'j5');
    // As if `contacts` and `tags` steps already recorded their mappings.
    await c.idMapper.record('j5', 'contacts', 10, 1001);
    await c.idMapper.record('j5', 'contacts', 20, 1002);
    await c.idMapper.record('j5', 'tags', 101, 501);
    await c.idMapper.record('j5', 'tags', 102, 502);

    await new ContactTagsImporter().run(c);

    const rows = (await ds.getRepository(ContactTagEntity).find()).sort((a, b) => a.contactId - b.contactId || a.tagId - b.tagId);
    expect(rows).toEqual([
      { contactId: 1001, tagId: 501, accountId: 1 },
      { contactId: 1001, tagId: 502, accountId: 1 },
      { contactId: 1002, tagId: 501, accountId: 1 },
    ]);
  });

  it('6. contact_tags is idempotent: re-running does not duplicate links', async () => {
    const seed = async () => {
      const c = ctx('account', 'j6');
      await c.idMapper.record('j6', 'contacts', 10, 1001);
      await c.idMapper.record('j6', 'contacts', 20, 1002);
      await c.idMapper.record('j6', 'tags', 101, 501);
      await c.idMapper.record('j6', 'tags', 102, 502);
      return c;
    };
    await new ContactTagsImporter().run(await seed());
    await new ContactTagsImporter().run(await seed());
    expect(await ds.getRepository(ContactTagEntity).count()).toBe(3);
  });

  it('7. contact_tags instance-scope: preserves source ids', async () => {
    await new ContactTagsImporter().run(ctx('instance', 'j7'));
    const rows = (await ds.getRepository(ContactTagEntity).find()).sort((a, b) => a.contactId - b.contactId || a.tagId - b.tagId);
    expect(rows).toEqual([
      { contactId: 10, tagId: 101, accountId: 1 },
      { contactId: 10, tagId: 102, accountId: 1 },
      { contactId: 20, tagId: 101, accountId: 1 },
    ]);
  });

  it('8. contact_custom_fields account-scope: remaps ids and persists value/number against the real DDL', async () => {
    const c = ctx('account', 'j8');
    await c.idMapper.record('j8', 'contacts', 10, 1001);
    await c.idMapper.record('j8', 'contacts', 20, 1002);
    await c.idMapper.record('j8', 'custom-fields', 100, 700);
    await c.idMapper.record('j8', 'custom-fields', 200, 800);

    await new ContactCustomFieldsImporter().run(c);

    const rows = (await ds.getRepository(ContactCustomFieldEntity).find()).sort((a, b) => a.contactId - b.contactId || a.customFieldId - b.customFieldId);
    expect(
      rows.map((r) => ({ contactId: r.contactId, customFieldId: r.customFieldId, value: r.value, number: r.number === null ? null : Number(r.number), accountId: r.accountId })),
    ).toEqual([
      { contactId: 1001, customFieldId: 700, value: 'Acme', number: null, accountId: 1 },
      { contactId: 1001, customFieldId: 800, value: '42', number: 42, accountId: 1 },
      { contactId: 1002, customFieldId: 700, value: 'Globex', number: null, accountId: 1 },
    ]);
  });

  it('9. contact_custom_fields is idempotent: re-running does not duplicate', async () => {
    const seed = async () => {
      const c = ctx('account', 'j9');
      await c.idMapper.record('j9', 'contacts', 10, 1001);
      await c.idMapper.record('j9', 'contacts', 20, 1002);
      await c.idMapper.record('j9', 'custom-fields', 100, 700);
      await c.idMapper.record('j9', 'custom-fields', 200, 800);
      return c;
    };
    await new ContactCustomFieldsImporter().run(await seed());
    await new ContactCustomFieldsImporter().run(await seed());
    expect(await ds.getRepository(ContactCustomFieldEntity).count()).toBe(3);
  });

  it('10. contact_custom_fields instance-scope: preserves source ids', async () => {
    await new ContactCustomFieldsImporter().run(ctx('instance', 'j10'));
    const rows = (await ds.getRepository(ContactCustomFieldEntity).find()).sort((a, b) => a.contactId - b.contactId || a.customFieldId - b.customFieldId);
    // field 999 is preserved too (instance-scope does not remap/skip).
    expect(rows.map((r) => ({ contactId: r.contactId, customFieldId: r.customFieldId }))).toEqual([
      { contactId: 10, customFieldId: 100 },
      { contactId: 10, customFieldId: 200 },
      { contactId: 20, customFieldId: 100 },
      { contactId: 20, customFieldId: 999 },
    ]);
  });

  // EVO-1761: against the real DDL (testab_sent_after_test boolean NOT NULL
  // DEFAULT false), a null source value must persist as the column default
  // instead of an explicit NULL. Before the fix this INSERT threw
  // "null value in column ... violates not-null constraint".
  it('11. campaigns account-scope: null source for a NOT NULL-default column imports as the default (EVO-1761)', async () => {
    await new CampaignsImporter().run(ctx('account', 'j11'));

    const campaigns = await ds.getRepository(CampaignEntity).find({ order: { name: 'ASC' } });
    expect(campaigns.map((c) => c.name)).toEqual(['newsletter', 'promo']);
    // The three columns the source sent as null fell back to their declared defaults.
    expect(campaigns.every((c) => c.testabSentAfterTest === false)).toBe(true);
    expect(campaigns.every((c) => c.sendToAll === false)).toBe(true);
    expect(campaigns.every((c) => c.messageType === 'email')).toBe(true);
    // A column the source actually provided is preserved verbatim.
    expect(campaigns.every((c) => c.title.startsWith('Campaign '))).toBe(true);
  });

  it('12. campaigns instance-scope: default fill also reaches the raw INSERT (EVO-1761)', async () => {
    await new CampaignsImporter().run(ctx('instance', 'j12'));

    const campaigns = await ds.getRepository(CampaignEntity).find();
    expect(campaigns.map((c) => c.id).sort()).toEqual([201, 202]); // source ids preserved
    expect(campaigns.every((c) => c.testabSentAfterTest === false)).toBe(true);
    expect(campaigns.every((c) => c.messageType === 'email')).toBe(true);
  });
});
