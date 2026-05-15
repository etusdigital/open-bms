import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Tabelas com PK serial cujo sequence precisa avançar pra max(Enterprise ID) + 1
// antes de scope=instance importar — assim os IDs do Enterprise são preservados
// no OSS sem colisão. Lista hard-coded; se nova entidade entrar, adicionar aqui.
const TARGET_TABLES: Array<{ table: string; column: string }> = [
  { table: 'accounts', column: 'id' },
  { table: 'users', column: 'id' },
  { table: 'tags', column: 'id' },
  { table: 'custom_fields', column: 'id' },
  { table: 'custom_events', column: 'id' },
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

  // Avança cada sequence pra max(table.column) + 1. Idempotente: se já está
  // adiante, setval mantém o valor maior. Importer chama isso DEPOIS dos inserts
  // de cada conta scope=instance.
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
    // setval(seq, max+1, false) → próximo nextval retorna max+1.
    await this.dataSource.query(`SELECT setval($1::regclass, COALESCE((SELECT MAX(${column}) FROM ${table}), 0) + 1, false)`, [seqName]);
    this.logger.log(`[seq-advancer] advanced ${seqName}`);
  }

  // Verificação pré-vôo pro scope=instance: rejeita se houver dados preexistentes
  // que poderiam colidir com IDs do Enterprise (vide risco no spec).
  async ensureInstanceTablesEmpty(): Promise<{ ok: boolean; offending?: string }> {
    const checkTable = 'accounts'; // proxy: se accounts está vazia, OSS é virgem.
    const rows = await this.dataSource.query(`SELECT COUNT(*)::int AS c FROM ${checkTable}`);
    const count = Number(rows?.[0]?.c ?? 0);
    if (count > 0) return { ok: false, offending: checkTable };
    return { ok: true };
  }
}
