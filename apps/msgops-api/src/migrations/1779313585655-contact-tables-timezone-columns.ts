import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EVO-1415 — fix timezone handling for contact dates.
 *
 * Several date columns on `contacts` / `contacts_automations` were `timestamp without
 * time zone` while the entities declare them `timestamptz`. With a timezone-naive column
 * the `pg` driver interprets the stored value in the Node process timezone
 * (`TZ=America/Sao_Paulo`), so UTC instants were read back shifted +3h and surfaced wrong
 * in the contact list and activity history.
 *
 * Stored values are UTC wall-clocks, so they are relabeled with `AT TIME ZONE 'UTC'` —
 * the same transform migration 1684523120291 applied to other tables (`tags`, `users`,
 * `accounts`, ...). The `contacts` columns `blocked_at` / `bounced_at` / `unsubscribed_at`
 * are intentionally left out: they were created as `timestamptz` from the start
 * (migrations 1726003569576 and 1773100000000) and need no conversion.
 *
 * The conversion is guarded per column: it only runs when the column is currently
 * `timestamp without time zone`. This keeps the migration safe under schema drift — a
 * column already `timestamptz` (e.g. via TypeORM `synchronize`) is left untouched instead
 * of being shifted by the session offset, and makes the migration idempotent.
 *
 * Note: `ALTER COLUMN ... TYPE` takes an ACCESS EXCLUSIVE lock and rewrites the whole
 * table. Schedule accordingly when `contacts` is large.
 */
export class ContactTablesTimezoneColumns1779313585655 implements MigrationInterface {
  private readonly targets: Array<[table: string, column: string]> = [
    ['contacts_automations', 'created_at'],
    ['contacts_automations', 'updated_at'],
    ['contacts', 'created_at'],
    ['contacts', 'updated_at'],
    ['contacts', 'last_open'],
    ['contacts', 'last_click'],
    ['contacts', 'last_sent'],
    ['contacts', 'last_automation'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.convertColumns(queryRunner, 'timestamp without time zone', 'TIMESTAMP WITH TIME ZONE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.convertColumns(queryRunner, 'timestamp with time zone', 'TIMESTAMP WITHOUT TIME ZONE');
  }

  /**
   * Convert each target column to `targetType`, but only when it currently has
   * `fromDataType` (as reported by `information_schema.columns.data_type`). Both
   * directions relabel via `AT TIME ZONE 'UTC'`, a symmetric transform: naive → tz
   * interprets the wall-clock as UTC; tz → naive yields the UTC wall-clock.
   */
  private async convertColumns(queryRunner: QueryRunner, fromDataType: string, targetType: string): Promise<void> {
    for (const [table, column] of this.targets) {
      const rows = await queryRunner.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2 AND data_type = $3`,
        [table, column, fromDataType],
      );
      if (rows.length === 0) continue;

      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE ${targetType} USING "${column}" AT TIME ZONE 'UTC'`);
    }
  }
}
