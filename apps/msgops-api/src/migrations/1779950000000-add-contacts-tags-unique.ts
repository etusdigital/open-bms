import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

// EVO-1437: contacts_tags has no unique constraint despite ContactTagEntity
// declaring (contact_id, tag_id, account_id) as @PrimaryColumn — the table was
// created in 1646740483923 without a PK and 1665030509810 added account_id as
// nullable. ContactsService.attachTags relies on ON CONFLICT DO NOTHING to
// dedupe concurrent inserts of the same (contact, tag) pair; without this
// constraint a race produces duplicate rows and duplicate "add" events.
//
// account_id moves to NOT NULL so the constraint catches every row.
// Postgres treats NULL as distinct in unique constraints by default — leaving
// account_id nullable would let legacy NULL rows duplicate silently.
export class AddContactsTagsUnique1779950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const orphans = await queryRunner.query(`SELECT COUNT(*)::int AS n FROM contacts_tags WHERE account_id IS NULL`);
    if (orphans[0].n > 0) {
      throw new Error(
        `contacts_tags has ${orphans[0].n} row(s) with account_id IS NULL. ` +
          `Backfill account_id (from contacts.account_id) or delete the orphans before running this migration.`,
      );
    }

    const dups = await queryRunner.query(
      `SELECT account_id, contact_id, tag_id, COUNT(*) AS n
         FROM contacts_tags
         GROUP BY account_id, contact_id, tag_id
         HAVING COUNT(*) > 1
         LIMIT 5`,
    );
    if (dups.length > 0) {
      const dedupeSql =
        `DELETE FROM contacts_tags a ` +
        `USING contacts_tags b ` +
        `WHERE a.ctid < b.ctid ` +
        `AND a.account_id = b.account_id ` +
        `AND a.contact_id = b.contact_id ` +
        `AND a.tag_id = b.tag_id;`;
      throw new Error(
        `contacts_tags has duplicate rows on (account_id, contact_id, tag_id). ` +
          `Sample: ${JSON.stringify(dups)}. ` +
          `Deduplicate before running this migration. Suggested SQL (keeps the most recent row by ctid): ${dedupeSql}`,
      );
    }

    await queryRunner.query(`ALTER TABLE "contacts_tags" ALTER COLUMN "account_id" SET NOT NULL`);

    // Idempotent: tolerate a prior partial run or hand-applied patch.
    await queryRunner.query(`ALTER TABLE "contacts_tags" DROP CONSTRAINT IF EXISTS "contacts_tags_unique"`);
    await queryRunner.createUniqueConstraint(
      'contacts_tags',
      new TableUnique({
        name: 'contacts_tags_unique',
        columnNames: ['account_id', 'contact_id', 'tag_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint('contacts_tags', 'contacts_tags_unique');
    await queryRunner.query(`ALTER TABLE "contacts_tags" ALTER COLUMN "account_id" DROP NOT NULL`);
  }
}
