import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddAccountIdToContactCustomFields1664826917594 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'account_id',
      type: 'int',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts_custom_fields', this.columns);
    await queryRunner.createForeignKey(
      'contacts_custom_fields',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('contacts_custom_fields', this.columns);
  }
}
