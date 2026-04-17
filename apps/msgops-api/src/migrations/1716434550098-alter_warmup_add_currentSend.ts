import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterWarmupAddCurrentSend1716434550098 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'remaining_send_today',
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
