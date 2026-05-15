import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

// Reinstates the unique constraint on contacts_custom_fields that was dropped
// by 1708357825013 (alter_contacts_custom_fields_add_time_and_number_columns)
// and never re-created. The current MsgopsService.createOrUpdateCustomFields
// upsert uses ON CONFLICT (account_id, contact_id, custom_field_id) — without
// a matching constraint Postgres raises 42P10 and the message-trigger worker
// crashes on every updateCustomField step.
//
// Pre-check fails fast if duplicate rows exist so the operator deduplicates
// before the constraint is added rather than discovering the data issue at
// runtime.
export class AddContactsCustomFieldsUnique1778883600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dups = await queryRunner.query(
      `SELECT account_id, contact_id, custom_field_id, COUNT(*) AS n
         FROM contacts_custom_fields
         GROUP BY account_id, contact_id, custom_field_id
         HAVING COUNT(*) > 1
         LIMIT 5`,
    );
    if (dups.length > 0) {
      throw new Error(
        `contacts_custom_fields has duplicate rows on (account_id, contact_id, custom_field_id). ` + `Deduplicate before running this migration. Sample: ${JSON.stringify(dups)}`,
      );
    }

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
  }
}
