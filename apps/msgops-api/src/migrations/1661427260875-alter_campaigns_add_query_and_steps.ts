import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterCampaignsAddQueryAndFilter1661427260875 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'query',
      type: 'text',
      isNullable: true,
    }),
    new TableColumn({
      name: 'steps',
      type: 'json',
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
