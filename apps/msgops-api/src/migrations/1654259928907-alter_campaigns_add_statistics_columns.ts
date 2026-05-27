import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterCampaignsAddStatisticsColumns1654259928907 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'campaigns',
      new TableColumn({
        name: 'sent_contacts',
        type: 'int',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'campaigns',
      new TableColumn({
        name: 'sent_percentage',
        type: 'decimal',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('campaigns', 'sent_contacts');
    await queryRunner.dropColumn('campaigns', 'sent_percentage');
  }
}
