import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addSentToAllToCampaigns1676664251157 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'send_to_all',
      type: 'boolean',
      default: false,
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
