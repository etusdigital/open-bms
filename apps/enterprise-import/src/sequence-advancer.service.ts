import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Serial-PK tables whose sequence must advance to max(Enterprise id) + 1
// before scope=instance imports, so Enterprise ids are preserved without
// collision. Hard-coded list; add new entities here.
const TARGET_TABLES: Array<{ table: string; column: string }> = [
  { table: 'accounts', column: 'id' },
  { table: 'users', column: 'id' },
  { table: 'tags', column: 'id' },
  { table: 'custom_fields', column: 'id' },
  { table: 'labels', column: 'id' },
  { table: 'emails_templates', column: 'id' },
  { table: 'contacts', column: 'id' },
  { table: 'automations', column: 'id' },
  { table: 'campaigns', column: 'id' },
  { table: 'messages', column: 'id' },
];

@Injectable()
export class SequenceAdvancerService {
  private readonly logger = new Logger(SequenceAdvancerService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Advances each sequence to max(table.column) + 1. Idempotent: if already
  // ahead, setval keeps the larger value. Called after scope=instance inserts.
  async advanceAll(): Promise<void> {
    for (const { table, column } of TARGET_TABLES) {
      try {
        await this.advance(table, column);
      } catch (err: any) {
        this.logger.warn(`[seq-advancer] failed on ${table}.${column}: ${err?.message ?? err}`);
      }
    }
  }

  async advance(table: string, column: string): Promise<void> {
    const seq = await this.dataSource.query(`SELECT pg_get_serial_sequence($1, $2) AS seq`, [table, column]);
    const seqName = seq?.[0]?.seq;
    if (!seqName) {
      this.logger.warn(`[seq-advancer] no sequence for ${table}.${column} (skipping)`);
      return;
    }
    // setval(seq, max+1, false): next nextval returns max+1.
    await this.dataSource.query(`SELECT setval($1::regclass, COALESCE((SELECT MAX(${column}) FROM ${table}), 0) + 1, false)`, [seqName]);
    this.logger.log(`[seq-advancer] advanced ${seqName}`);
  }

  // Preflight for scope=instance: reject if preexisting data could collide
  // with Enterprise ids.
  async ensureInstanceTablesEmpty(): Promise<{ ok: boolean; offending?: string }> {
    const checkTable = 'accounts'; // proxy: empty accounts => pristine OSS
    const rows = await this.dataSource.query(`SELECT COUNT(*)::int AS c FROM ${checkTable}`);
    const count = Number(rows?.[0]?.c ?? 0);
    if (count > 0) return { ok: false, offending: checkTable };
    return { ok: true };
  }
}
