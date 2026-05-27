import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addLastVerticalTypeColumn1738074056910 implements MigrationInterface {
  private column = new TableColumn({
    name: 'last_vertical_type',
    type: 'varchar',
    length: '255',
    isNullable: true,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('contacts', this.column);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('contacts', this.column);
  }
}
