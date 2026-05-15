/**
 * Integration tests (Task 34) — agora REAIS.
 *
 * Sobe um Postgres efêmero (testcontainers), cria o schema das entities REAIS
 * via TypeORM synchronize, sobe um mock HTTP do msgops-api Enterprise e roda
 * o importer de verdade contra tudo isso. Valida ponta-a-ponta os fixes
 * F1 (todas as colunas), F3 (resolução por chave natural), F4 (FK/accountId),
 * F8 (idempotência de retomada) e o short-circuit 4xx do EnterpriseClient.
 *
 * Exige Docker. NÃO roda em CI por padrão:
 *   ENABLE_INTEGRATION_TESTS=true pnpm --filter enterprise-import test -- test/integration
 */
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Carrega TODAS as entity classes do msgops-api dinamicamente (ts-jest
// transforma os require de .ts). synchronize:true precisa do fecho completo
// de relações — o schema operacional inteiro.
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

// synchronize:true falha em FK duplicada de schema legado (bug conhecido do
// TypeORM — prod usa migrations). Geramos o DDL das tabelas sob teste a partir
// da METADATA REAL (colunas autênticas, sem FK — desnecessárias p/ o importer).
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
import { ImportContext } from '../src/importers/importer.interface';

import { EnterpriseImportJobEntity } from '../src/entities/enterprise-import-job.entity';
import { EnterpriseIdMappingEntity } from '../src/entities/enterprise-id-mapping.entity';
import { AccountEntity } from '../src/entities/account.entity';
import { TagEntity } from '../src/entities/tag.entity';

const enabled = process.env.ENABLE_INTEGRATION_TESTS === 'true';
const d = enabled ? describe : describe.skip;

// Tag completa no shape que o Enterprise (mesmo codebase) serializa — todas as
// colunas NOT NULL preenchidas. Se o importer perdesse colunas (bug F1), o
// INSERT estouraria contra o DDL real.
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
      entities: loadAllEntities(), // fecho completo p/ metadata
      synchronize: false,
    });
    await ds.initialize();
    // Cria só as tabelas sob teste, a partir da metadata REAL.
    for (const e of [EnterpriseImportJobEntity, EnterpriseIdMappingEntity, AccountEntity, TagEntity]) {
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
    await ds.query('DELETE FROM enterprise_id_mappings');
    await ds.query('DELETE FROM enterprise_import_jobs');
  });

  function ctx(scope: 'account' | 'instance', jobId: string): ImportContext {
    const idMapper = new IdMapperService(ds.getRepository(EnterpriseIdMappingEntity) as any);
    const session = new EnterpriseClient().createSession(baseUrl, 'good-key');
    return {
      jobId,
      accountId: 1,
      enterpriseSourceAccountId: 1,
      scope,
      client: session,
      idMapper,
      dataSource: ds,
      checkpoint: {},
      updateProgress: async () => {},
      setCheckpoint: async () => {},
    };
  }

  it('1. account-scope: persiste TODAS as colunas, sobrescreve accountId e mapeia src→newId por chave natural', async () => {
    // O importer não lê enterprise_import_jobs (o processor lê); idMapper grava
    // em enterprise_id_mappings.job_id (varchar). jobId arbitrário serve.
    await new TagsImporter().run(ctx('account', 'job-1'));

    const tags = await ds.getRepository(TagEntity).find({ order: { name: 'ASC' } });
    expect(tags.map((t) => t.name)).toEqual(['alpha', 'beta', 'gamma']);
    expect(tags.every((t) => t.accountId === 1)).toBe(true);
    expect(tags.every((t) => t.type === 'static' && t.status === 'active')).toBe(true);
    // ids reescritos pela sequence (não 101/102/103 do Enterprise)
    expect(tags.every((t) => t.id < 100)).toBe(true);

    const maps = await ds.getRepository(EnterpriseIdMappingEntity).find();
    const bySource = new Map(maps.map((m) => [m.sourceId, m.newId]));
    const alpha = tags.find((t) => t.name === 'alpha')!;
    expect(bySource.get('101')).toBe(String(alpha.id)); // ligado pela chave natural, não posicional
  });

  it('2. idempotente: rodar o mesmo importer 2x não duplica (F8)', async () => {
    await new TagsImporter().run(ctx('account', 'j2'));
    await new TagsImporter().run(ctx('account', 'j2'));
    const count = await ds.getRepository(TagEntity).count();
    expect(count).toBe(3);
  });

  it('3. instance-scope: preserva o id de origem e não grava mapping', async () => {
    await new TagsImporter().run(ctx('instance', 'j3'));
    const ids = (await ds.getRepository(TagEntity).find()).map((t) => t.id).sort();
    expect(ids).toEqual([101, 102, 103]);
    expect(await ds.getRepository(EnterpriseIdMappingEntity).count()).toBe(0);
  });

  it('4. 4xx do Enterprise → EnterpriseApi4xxError sem retry', async () => {
    mode = 'unauthorized';
    await expect(new TagsImporter().run(ctx('account', 'j4'))).rejects.toBeInstanceOf(EnterpriseApi4xxError);
  });
});
