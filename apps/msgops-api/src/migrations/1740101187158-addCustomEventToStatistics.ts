import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addCustomEventToStatistics1740101187158 implements MigrationInterface {
  private newColumns = [
    new TableColumn({
      name: 'events_count',
      type: 'integer',
      isNullable: true,
    }),
    new TableColumn({
      name: 'events_unique',
      type: 'integer',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('events_statistics', this.newColumns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('events_statistics', this.newColumns);
  }
}
