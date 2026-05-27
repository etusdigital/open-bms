import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addUtmCampaignToStatistics1740514520872 implements MigrationInterface {
  private newColumns = [
    new TableColumn({
      name: 'utm_campaign',
      type: 'varchar',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('events_statistics', this.newColumns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('events_statistics', this.newColumns);
  }
}
