import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addDefaultToUpdatedAt1682693654610 implements MigrationInterface {
  private columns = [
    {
      oldColumn: new TableColumn({
        name: 'updated_at',
        type: 'TIMESTAMP',
        isNullable: true,
        onUpdate: 'CURRENT_TIMESTAMP',
      }),
      newColumn: new TableColumn({
        name: 'updated_at',
        type: 'TIMESTAMP',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
      }),
    },
  ];

  private tables = ['accounts', 'automations', 'automations_message', 'campaigns', 'custom_fields', 'emails_templates', 'pools', 'tags', 'users'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`UPDATE ${table} SET updated_at = created_at WHERE updated_at IS NULL`);
      await queryRunner.changeColumns(table, this.columns);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumns('automations', this.columns);
  }
}
