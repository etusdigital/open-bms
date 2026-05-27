import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class createTableContactsCustomFields1658319097123 implements MigrationInterface {
  private table = new Table({
    name: 'contacts_custom_fields',
    columns: [
      {
        name: 'contact_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'custom_field_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'value',
        type: 'text',
        isNullable: false,
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'contacts_custom_fields',
      new TableForeignKey({
        columnNames: ['contact_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'contacts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'contacts_custom_fields',
      new TableForeignKey({
        columnNames: ['custom_field_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'custom_fields',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createUniqueConstraint(
      'contacts_custom_fields',
      new TableUnique({
        name: 'contacts_custom_fields_unique',
        columnNames: ['contact_id', 'custom_field_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
