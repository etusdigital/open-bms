import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterContactsDropCustomFields1658319123800 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('contacts', 'custom_fields');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('contacts', new TableColumn({ name: 'custom_fields', type: 'jsonb' }));
  }
}
