import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addIsMasterUserAccount1657817041374 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users_accounts',
      new TableColumn({
        name: 'is_master_user',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users_accounts DROP COLUMN is_master_user`);
  }
}
