import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addVerticalTypeColumn1738072473563 implements MigrationInterface {
  private column = new TableColumn({
    name: 'vertical_type',
    type: 'varchar',
    length: '255',
    isNullable: true,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('automations', this.column);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('automations', this.column);
  }
}
