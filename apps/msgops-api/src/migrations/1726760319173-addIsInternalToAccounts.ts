import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addIsInternalToAccounts1726760319173 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'group_id',
      type: 'integer',
      isNullable: true,
    }),
    new TableColumn({
      name: 'is_internal',
      type: 'boolean',
      isNullable: false,
      default: false,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('accounts', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('accounts', this.columns);
  }
}
