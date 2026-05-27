import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterTagsAddSegmentInfo1669143883340 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'segment_info',
      type: 'jsonb',
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
