import { MigrationInterface, QueryRunner } from 'typeorm';

export class campaignsNameUniquePartial1778000000000 implements MigrationInterface {
  name = 'campaignsNameUniquePartial1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Soft-deleted campaigns keep their (name, account_id) row, but the existing
    // UNIQUE constraint blocks reusing that name. Replace it with a partial unique
    // index that only enforces uniqueness across live rows.
    await queryRunner.query(`ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS "campaigns_name_unique"`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "campaigns_name_account_unique_active" ON campaigns (name, account_id) WHERE deleted_at IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "campaigns_name_account_unique_active"`);
    await queryRunner.query(`ALTER TABLE campaigns ADD CONSTRAINT "campaigns_name_unique" UNIQUE (name, account_id)`);
  }
}
