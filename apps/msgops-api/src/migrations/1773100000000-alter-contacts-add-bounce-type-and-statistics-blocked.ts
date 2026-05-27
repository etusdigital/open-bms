import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterContactsAddBounceTypeAndStatisticsBlocked1773100000000 implements MigrationInterface {
  name = 'alterContactsAddBounceTypeAndStatisticsBlocked1773100000000';

  private contactsColumns = [
    new TableColumn({
      name: 'bounce_type',
      type: 'varchar',
      length: '4',
      isNullable: true,
      comment: 'HARD or SOFT',
    }),
    new TableColumn({
      name: 'bounced_at',
      type: 'timestamptz',
      isNullable: true,
    }),
  ];

  private statisticsColumn = new TableColumn({
    name: 'blocked',
    type: 'integer',
    default: 0,
    isNullable: false,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts', this.contactsColumns);
    await queryRunner.addColumn('events_statistics', this.statisticsColumn);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('events_statistics', this.statisticsColumn);
    await queryRunner.dropColumns('contacts', this.contactsColumns);
  }
}
