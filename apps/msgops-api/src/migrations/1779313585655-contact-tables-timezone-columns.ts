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
 * same pattern as migration 1684523120291, which already converted other tables and the
 * `blocked_at` / `bounced_at` / `unsubscribed_at` columns of `contacts`.
 */
export class ContactTablesTimezoneColumns1779313585655 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE contacts_automations
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC'`);

    await queryRunner.query(`ALTER TABLE contacts
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC',
    ALTER COLUMN last_open TYPE TIMESTAMP WITH TIME ZONE USING last_open AT TIME ZONE 'UTC',
    ALTER COLUMN last_click TYPE TIMESTAMP WITH TIME ZONE USING last_click AT TIME ZONE 'UTC',
    ALTER COLUMN last_sent TYPE TIMESTAMP WITH TIME ZONE USING last_sent AT TIME ZONE 'UTC',
    ALTER COLUMN last_automation TYPE TIMESTAMP WITH TIME ZONE USING last_automation AT TIME ZONE 'UTC'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE contacts
    ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITHOUT TIME ZONE USING updated_at AT TIME ZONE 'UTC',
    ALTER COLUMN last_open TYPE TIMESTAMP WITHOUT TIME ZONE USING last_open AT TIME ZONE 'UTC',
    ALTER COLUMN last_click TYPE TIMESTAMP WITHOUT TIME ZONE USING last_click AT TIME ZONE 'UTC',
    ALTER COLUMN last_sent TYPE TIMESTAMP WITHOUT TIME ZONE USING last_sent AT TIME ZONE 'UTC',
    ALTER COLUMN last_automation TYPE TIMESTAMP WITHOUT TIME ZONE USING last_automation AT TIME ZONE 'UTC'`);

    await queryRunner.query(`ALTER TABLE contacts_automations
    ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITHOUT TIME ZONE USING updated_at AT TIME ZONE 'UTC'`);
  }
}
