import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterCampaignsAddStepsTriggers1755787127122 implements MigrationInterface {
  name = 'alterCampaignsAddStepsTriggers1755787127122';

  private triggers = new TableColumn({
    name: 'triggers',
    type: 'json',
    isNullable: true,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('campaigns', this.triggers);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('campaigns', this.triggers);
  }
}
