import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addProviderAccountToStatistics1740759370868 implements MigrationInterface {
  private newColumns = [
    new TableColumn({
      name: 'provider_account',
      type: 'varchar',
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
