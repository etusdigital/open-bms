import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAutomationsAddTarget1754584497211 implements MigrationInterface {
  name = 'alterAutomationsAddTarget1754584497211';

  private newColumn = new TableColumn({
    name: 'target',
    type: 'varchar',
    isNullable: true,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('automations', this.newColumn);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('automations', this.newColumn);
  }
}
