// INSERT raw multi-linha que PRESERVA a PK (instance-scope).
//
// O QueryBuilder do TypeORM IGNORA valor explícito numa coluna
// @PrimaryGeneratedColumn — então em scope=instance o id de origem não seria
// emitido e a sequence atribuiria um novo, quebrando a estratégia de
// preservação de id (SequenceAdvancer + idMapper identidade). Este helper
// emite um INSERT cru com TODAS as colunas, inclusive a PK, mapeando
// propriedade→coluna via metadata e serializando objetos/arrays p/ json(b).
// ON CONFLICT DO NOTHING mantém a idempotência de retomada (F8).
export async function rawInsertPreservingPk(
  em: { query: (sql: string, params?: any[]) => Promise<any> },
  tableName: string,
  dbNameByProp: Map<string, string>,
  rows: Record<string, any>[],
): Promise<void> {
  if (!rows.length) return;
  const props = Object.keys(rows[0]).filter((p) => dbNameByProp.has(p));
  if (props.length === 0) return;
  const cols = props.map((p) => `"${dbNameByProp.get(p)}"`).join(', ');
  const params: any[] = [];
  const tuples = rows.map((r) => {
    const ph = props.map((p) => {
      let v = r[p];
      if (v !== null && v !== undefined && typeof v === 'object' && !(v instanceof Date)) v = JSON.stringify(v);
      params.push(v ?? null);
      return `$${params.length}`;
    });
    return `(${ph.join(', ')})`;
  });
  await em.query(`INSERT INTO "${tableName}" (${cols}) VALUES ${tuples.join(', ')} ON CONFLICT DO NOTHING`, params);
}

// Map propriedade→nome-de-coluna a partir da metadata de um Repository TypeORM.
export function dbNameMap(meta: { columns: Array<{ propertyName: string; databaseName: string }> }): Map<string, string> {
  return new Map(meta.columns.map((c) => [c.propertyName, c.databaseName]));
}
