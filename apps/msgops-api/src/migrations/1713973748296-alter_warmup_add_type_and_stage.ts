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
    await queryRunner.addColumns('warmups', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('warmups', this.columns);
  }
}
