import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class createTableContactsTags1646740483923 implements MigrationInterface {
  private table = new Table({
    name: 'contacts_tags',
    columns: [
      {
        name: 'contact_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'tag_id',
        type: 'integer',
        isNullable: false,
      },
    ],
  });
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'contacts_tags',
      new TableForeignKey({
        columnNames: ['contact_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'contacts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'contacts_tags',
      new TableForeignKey({
        columnNames: ['tag_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tags',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'contacts_tags',
      new TableIndex({
        name: 'index_contacts_tags_contact_id',
        columnNames: ['contact_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
