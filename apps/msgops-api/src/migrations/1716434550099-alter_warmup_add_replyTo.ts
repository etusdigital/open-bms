import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterWarmupAddReplyTo1716434550099 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'reply_to',
      type: 'varchar',
      length: '255',
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
