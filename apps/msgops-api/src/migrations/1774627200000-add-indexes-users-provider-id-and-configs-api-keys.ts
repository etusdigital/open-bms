import { MigrationInterface, QueryRunner } from 'typeorm';

export class addIndexesUsersProviderIdAndConfigsApiKeys1774627200000 implements MigrationInterface {
  name = 'addIndexesUsersProviderIdAndConfigsApiKeys1774627200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users (provider_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_accounts_configs_api_keys ON accounts_configs (value) WHERE name IN ('api_key', 'api_key_tracker')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_provider_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_accounts_configs_api_keys`);
  }
}
