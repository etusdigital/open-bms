import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterWarmupAddTypeAndStage1713973748296 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'type',
      type: 'varchar',
      length: '20',
      isNullable: true,
    }),
    new TableColumn({
      name: 'stage',
      type: 'int',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Premium-only feature was removed (see 1776800000000-remove-premium-features).
    // On fresh installations the `warmups` table is never created, so skip silently.
    const exists = await queryRunner.hasTable('warmups');
    if (!exists) return;
    await queryRunner.addColumns('warmups', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('warmups');
    if (!exists) return;
    await queryRunner.dropColumns('warmups', this.columns);
  }
}
