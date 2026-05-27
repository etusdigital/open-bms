import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterTagsAddSegmentsConfigs1678291653168 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'add_bounced',
      type: 'boolean',
      isNullable: true,
    }),
    new TableColumn({
      name: 'add_unsubscribed',
      type: 'boolean',
      isNullable: true,
    }),
    new TableColumn({
      name: 'add_invalid',
      type: 'boolean',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('tags', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('tags', this.columns);
  }
}
