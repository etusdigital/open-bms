import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

// EVO-1278: reinstates the unique constraint on contacts_custom_fields that
// was dropped by 1708357825013 and never re-created. The current upsert in
// MsgopsService.createOrUpdateCustomFields does
// ON CONFLICT (account_id, contact_id, custom_field_id) — with no matching
// constraint Postgres raises 42P10 and the message-trigger worker crashes
// on every updateCustomField step.
//
// account_id also moves to NOT NULL so the constraint catches every row.
// Postgres treats NULL as distinct in unique constraints by default — leaving
// account_id nullable means legacy NULL rows would skip uniqueness and the
// upsert would silently insert duplicates instead of crashing.
export class AddContactsCustomFieldsUnique1778883600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const orphans = await queryRunner.query(`SELECT COUNT(*)::int AS n FROM contacts_custom_fields WHERE account_id IS NULL`);
    if (orphans[0].n > 0) {
      throw new Error(
        `contacts_custom_fields has ${orphans[0].n} row(s) with account_id IS NULL. ` +
          `Backfill account_id (from contacts.account_id) or delete the orphans before running this migration.`,
      );
    }

    const dups = await queryRunner.query(
      `SELECT account_id, contact_id, custom_field_id, COUNT(*) AS n
         FROM contacts_custom_fields
         GROUP BY account_id, contact_id, custom_field_id
         HAVING COUNT(*) > 1
         LIMIT 5`,
    );
    if (dups.length > 0) {
      const dedupeSql =
        `DELETE FROM contacts_custom_fields a ` +
        `USING contacts_custom_fields b ` +
        `WHERE a.ctid < b.ctid ` +
        `AND a.account_id = b.account_id ` +
        `AND a.contact_id = b.contact_id ` +
        `AND a.custom_field_id = b.custom_field_id;`;
      throw new Error(
        `contacts_custom_fields has duplicate rows on (account_id, contact_id, custom_field_id). ` +
          `Sample: ${JSON.stringify(dups)}. ` +
          `Deduplicate before running this migration. Suggested SQL (keeps the most recent row by ctid): ${dedupeSql}`,
      );
    }

    await queryRunner.query(`ALTER TABLE "contacts_custom_fields" ALTER COLUMN "account_id" SET NOT NULL`);

    // Idempotent: a prior partial run or a hand-applied patch may have left
    // the constraint already present. Drop-if-exists then create avoids
    // tripping on the duplicate name without skipping the canonical creation.
    await queryRunner.query(`ALTER TABLE "contacts_custom_fields" DROP CONSTRAINT IF EXISTS "contacts_custom_fields_unique"`);
    await queryRunner.createUniqueConstraint(
      'contacts_custom_fields',
      new TableUnique({
        name: 'contacts_custom_fields_unique',
        columnNames: ['account_id', 'contact_id', 'custom_field_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint('contacts_custom_fields', 'contacts_custom_fields_unique');
    await queryRunner.query(`ALTER TABLE "contacts_custom_fields" ALTER COLUMN "account_id" DROP NOT NULL`);
  }
}
