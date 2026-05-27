import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddUuidToContacts1665029405453 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'uuid',
      type: 'varchar',
      length: '40',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts', this.columns);
    await queryRunner.createIndex(
      'contacts',
      new TableIndex({
        name: 'index_contacts_uuid',
        columnNames: ['uuid'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('contacts', this.columns);
  }
}
