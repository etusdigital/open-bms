import { MigrationInterface, QueryRunner } from 'typeorm';

// CampaignEntity declares `triggers jsonb` since the OSS initial commit, but
// no migration created the column on the `campaigns` table — it was inherited
// from the SaaS schema where the column already existed. Any query that joins
// campaigns (e.g. GET /messages/:id, which leftJoins campaignMessage→campaign)
// fails with `column campaign.triggers does not exist` on a fresh OSS install.
// Add the column nullable so existing rows survive the migration.
export class AddTriggersToCampaigns1777680000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "triggers" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "triggers"`);
  }
}
