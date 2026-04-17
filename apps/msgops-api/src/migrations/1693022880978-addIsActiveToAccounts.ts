import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addIsActiveToAccounts1693022880978 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'is_active',
      type: 'boolean',
      default: true,
      isNullable: false,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('accounts', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('accounts', this.columns);
  }
}
