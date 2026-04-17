import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class createTableCampaignsContacts1662951016363 implements MigrationInterface {
  private table = new Table({
    name: 'campaigns_contacts',
    columns: [
      {
        name: 'campaign_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'contact_id',
        type: 'integer',
        isNullable: false,
      },
    ],
  });
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createPrimaryKey('campaigns_contacts', ['campaign_id', 'contact_id']);
    await queryRunner.createIndex(
      'campaigns_contacts',
      new TableIndex({
        name: 'index_campaigns_contacts_contact_id',
        columnNames: ['contact_id'],
      }),
    );
    await queryRunner.createIndex(
      'campaigns_contacts',
      new TableIndex({
        name: 'index_campaigns_contacts_campaign_id',
        columnNames: ['campaign_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
