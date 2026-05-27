import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddHashedEmailIndexToContacts1665028682802 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'contacts',
      new TableIndex({
        name: 'index_contacts_hashed_email',
        columnNames: ['hashed_email', 'account_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'contacts',
      new TableIndex({
        name: 'index_contacts_hashed_email',
        columnNames: ['hashed_email', 'account_id'],
      }),
    );
  }
}
