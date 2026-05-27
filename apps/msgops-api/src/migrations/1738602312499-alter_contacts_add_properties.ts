import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterContactsAddProperties1738593385595 implements MigrationInterface {
  name = 'alterContactsAddProperties1738593385595';

  private columnProperties = new TableColumn({
    name: 'properties',
    type: 'jsonb',
    isNullable: true,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('contacts', this.columnProperties);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('contacts', this.columnProperties);
  }
}
