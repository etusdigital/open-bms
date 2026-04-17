import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterTableCampaignsRulesAddWeekDays1753456032935 implements MigrationInterface {
  private newColumns = [
    new TableColumn({
      name: 'week_days',
      type: 'jsonb',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('campaigns_rules', this.newColumns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('campaigns_rules', this.newColumns);
  }
}
