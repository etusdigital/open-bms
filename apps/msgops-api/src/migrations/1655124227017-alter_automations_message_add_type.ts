import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAutomationsMessageAddType1655124227017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'automations_message',
      new TableColumn({
        name: 'type',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('automations_message', 'type');
  }
}
