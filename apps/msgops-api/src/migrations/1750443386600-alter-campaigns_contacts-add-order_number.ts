import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class alterCampaignsContactsAddOrderNumber1750443386600 implements MigrationInterface {
  private newColumns = [
    new TableColumn({
      name: 'order_number',
      type: 'integer',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('campaigns_contacts', this.newColumns);
    await queryRunner.createIndex(
      'campaigns_contacts',
      new TableIndex({
        name: 'idx_campaigns_contacts_camapign_and_order',
        columnNames: ['campaign_id', 'order_number'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('campaigns_contacts', this.newColumns);
  }
}
