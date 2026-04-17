import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterWarmupsAddTargetSegmentId1749065583307 implements MigrationInterface {
  private newColumns = [
    new TableColumn({
      name: 'target_segment_id',
      type: 'integer',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('warmups', this.newColumns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('warmups', this.newColumns);
  }
}
