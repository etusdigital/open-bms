import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAutomationsMessagesAddTestAbColumns1665406744334 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'statistics',
      type: 'jsonb',
      isNullable: true,
    }),
    new TableColumn({
      name: 'winner',
      type: 'boolean',
      isNullable: true,
    }),
    new TableColumn({
      name: 'result_date',
      type: 'TIMESTAMP',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('campaigns_messages', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('campaigns_messages', this.columns);
  }
}
