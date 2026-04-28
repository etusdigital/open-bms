import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePremiumFeatures1776800000000 implements MigrationInterface {
  name = 'RemovePremiumFeatures1776800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "ip_reputation_daily" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "campaigns_rules_configs" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "campaigns_rules" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "campaigns_configs" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "warmup_users" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "warmups" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "leads" CASCADE');

    // ALTER TABLE ... DROP COLUMN IF EXISTS only guards the column, not the
    // table. On a fresh DB the base tables haven't been created yet, so wrap
    // each ALTER in a `to_regclass` check to make the migration idempotent
    // for both legacy upgrades and brand-new installations.
    await this.dropColumnIfTableAndColumnExist(queryRunner, 'campaigns', 'is_warmup');
    await this.dropColumnIfTableAndColumnExist(queryRunner, 'pools', 'is_warmup');
    await this.dropColumnIfTableAndColumnExist(queryRunner, 'tags', 'external_query');
    await this.dropColumnIfTableAndColumnExist(queryRunner, 'emails_labels', 'product');
    // NOTE: campaigns.steps and campaigns.triggers columns are intentionally kept
    // because they may be used by other multi-step campaign types beyond
    // the removed Trigger Campaigns premium feature. They become dead columns.
  }

  private async dropColumnIfTableAndColumnExist(queryRunner: QueryRunner, table: string, column: string): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
         IF to_regclass('public."${table}"') IS NOT NULL THEN
           EXECUTE 'ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"';
         END IF;
       END $$;`,
    );
  }

  public async down(): Promise<void> {
    throw new Error('RemovePremiumFeatures is irreversible. Restore from backup if needed.');
  }
}
