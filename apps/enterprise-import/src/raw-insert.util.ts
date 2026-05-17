// Raw multi-row INSERT that preserves the PK (instance-scope).
// TypeORM's QueryBuilder ignores an explicit @PrimaryGeneratedColumn value,
// which would break id preservation; this emits a raw INSERT with all columns
// including the PK. ON CONFLICT DO NOTHING keeps resume idempotent.
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

// Build a property -> column-name map from a TypeORM Repository's metadata.
export function dbNameMap(meta: { columns: Array<{ propertyName: string; databaseName: string }> }): Map<string, string> {
  return new Map(meta.columns.map((c) => [c.propertyName, c.databaseName]));
}
