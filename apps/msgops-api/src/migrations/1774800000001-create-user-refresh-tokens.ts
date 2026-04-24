import { MigrationInterface, QueryRunner } from 'typeorm';

export class createUserRefreshTokens1774800000001 implements MigrationInterface {
  name = 'createUserRefreshTokens1774800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_refresh_tokens (
        id BIGSERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_agent TEXT NULL,
        ip INET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_refresh_tokens_user_id ON user_refresh_tokens (user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_refresh_tokens_expires ON user_refresh_tokens (expires_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_refresh_tokens_expires`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_refresh_tokens_user_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_refresh_tokens`);
  }
}
