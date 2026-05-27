import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterTagsAddIsRealTimeSegment1696346367543 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'is_real_time_segment',
      type: 'boolean',
      default: false,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('tags', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('tags', this.columns);
  }
}
