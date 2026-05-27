import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addRecurrenceCountToCampaigns1692217695401 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'recurrence_count',
      type: 'int',
      isNullable: true,
    }),

    new TableColumn({
      name: 'recurrence_settings',
      type: 'jsonb',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('campaigns', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('campaigns', this.columns);
  }
}
