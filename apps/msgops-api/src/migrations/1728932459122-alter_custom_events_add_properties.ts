import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterCustomEventsAddProperties1728932459122 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'properties',
      type: 'jsonb',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('custom_events', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('custom_events', this.columns);
  }
}
