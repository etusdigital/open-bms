import { MigrationInterface, QueryRunner, TableColumn, TableUnique } from 'typeorm';

export class alterContactsCustomFieldsAddTimeAndNumberColumns1708357825013 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'time',
      type: 'timestamp with time zone',
      isNullable: true,
    }),
    new TableColumn({
      name: 'number',
      type: 'decimal',
      isNullable: true,
    }),
    new TableColumn({
      name: 'created_at',
      type: 'timestamp with time zone',
      isNullable: false,
      default: 'CURRENT_TIMESTAMP',
    }),
    new TableColumn({
      name: 'updated_at',
      type: 'timestamp with time zone',
      onUpdate: 'CURRENT_TIMESTAMP',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts_custom_fields', this.columns);
    await queryRunner.query('ALTER TABLE "contacts_custom_fields" DROP CONSTRAINT IF EXISTS "contacts_custom_fields_unique"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('contacts_custom_fields', this.columns);
    await queryRunner.createUniqueConstraint(
      'contacts_custom_fields',
      new TableUnique({
        name: 'contacts_custom_fields_unique',
        columnNames: ['contact_id', 'custom_field_id'],
      }),
    );
  }
}
