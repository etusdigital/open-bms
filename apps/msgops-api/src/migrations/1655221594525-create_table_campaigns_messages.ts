import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class createTableCampaignsMessages1655221594525 implements MigrationInterface {
  private table = new Table({
    name: 'campaigns_messages',
    columns: [
      {
        name: 'campaign_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'message_id',
        type: 'integer',
        isNullable: false,
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'campaigns_messages',
      new TableForeignKey({
        columnNames: ['campaign_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'campaigns',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'campaigns_messages',
      new TableForeignKey({
        columnNames: ['message_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'automations_message',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createPrimaryKey('campaigns_messages', ['campaign_id', 'message_id']);
    await queryRunner.createIndex(
      'campaigns_messages',
      new TableIndex({
        name: 'index_campaigns_messages_campaign_id',
        columnNames: ['campaign_id'],
      }),
    );
    await queryRunner.createIndex(
      'campaigns_messages',
      new TableIndex({
        name: 'index_campaigns_messages_message_id',
        columnNames: ['message_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
