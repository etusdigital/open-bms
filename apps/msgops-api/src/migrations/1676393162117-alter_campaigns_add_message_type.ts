import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterCampaignsAddMessageType1676393162117 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'message_type',
      type: 'varchar',
      length: '30',
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
