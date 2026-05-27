import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addfieldTypeToCustomFields1712895043843 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'field_type',
      type: 'varchar',
      length: '20',
      default: `'text'`,
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('custom_fields', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('custom_fields', this.columns);
  }
}
