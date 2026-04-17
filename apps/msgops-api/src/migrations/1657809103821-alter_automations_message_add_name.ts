import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAutomationsMessageAddName1657809103821 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'automations_message',
      new TableColumn({
        name: 'name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('automations_message', 'name');
  }
}
