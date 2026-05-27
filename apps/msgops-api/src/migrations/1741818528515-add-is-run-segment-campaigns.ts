import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addIsRunSegmentCampaigns1741818528515 implements MigrationInterface {
  private newColumns = [
    new TableColumn({
      name: 'is_run_segment',
      type: 'boolean',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('campaigns', this.newColumns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('campaigns', this.newColumns);
  }
}
