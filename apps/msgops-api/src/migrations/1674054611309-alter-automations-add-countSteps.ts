import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAutomationsAddCountSteps1674054611309 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'count_steps',
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
