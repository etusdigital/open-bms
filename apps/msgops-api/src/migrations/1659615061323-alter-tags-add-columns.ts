import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterTagsAddColumns1659615061323 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'description',
      type: 'text',
      isNullable: true,
    }),
    new TableColumn({
      name: 'type',
      type: 'varchar',
      length: '255',
      default: `'tag'`,
      isNullable: true,
    }),
    new TableColumn({
      name: 'recurrence',
      type: 'int',
      isNullable: true,
    }),
    new TableColumn({
      name: 'schedule_cloud_task_id',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'query',
      type: 'text',
      isNullable: true,
    }),
    new TableColumn({
      name: 'steps',
      type: 'json',
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
