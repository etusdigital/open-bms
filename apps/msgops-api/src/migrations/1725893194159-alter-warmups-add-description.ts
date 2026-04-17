import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterWarmupsAddDescription1725893194159 implements MigrationInterface {
  private column = new TableColumn({
    name: 'description',
    type: 'text',
    isNullable: true,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('warmups', this.column);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('warmups', this.column);
  }
}
