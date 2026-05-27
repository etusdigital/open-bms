import { MigrationInterface, QueryRunner } from 'typeorm';

export class addAccountsConfigsUniqueConstraints1692990139304 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE accounts_configs DROP CONSTRAINT IF EXISTS accounts_configs_unique`);
    await queryRunner.query(`ALTER TABLE accounts_configs ADD CONSTRAINT accounts_configs_unique UNIQUE (account_id, name)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE accounts_configs DROP CONSTRAINT IF EXISTS accounts_configs_unique`);
    await queryRunner.query(`ALTER TABLE accounts_configs ADD CONSTRAINT accounts_configs_unique UNIQUE (account_id, name, description)`);
  }
}
