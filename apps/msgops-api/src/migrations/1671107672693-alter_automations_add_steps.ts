import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAutomationsAddSteps1671107672693 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'steps',
      type: 'jsonb',
      isNullable: true,
    }),
    new TableColumn({
      name: 'triggers',
      type: 'jsonb',
      isNullable: true,
    }),
    new TableColumn({
      name: 'step_id',
      type: 'int',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('automations', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('automations', this.columns);
  }
}
