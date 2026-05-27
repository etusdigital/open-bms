import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sets `has_whatsapp = true` for every contact that already has a phone.
 *
 * Background: the previous Evolution integration filled this column via a
 * "is-this-number-on-WhatsApp" check. WhatsApp Cloud has no public check
 * endpoint, so the new behavior (see contact.entity.ts setUserDetails())
 * mirrors `has_phone` into `has_whatsapp` at insert/update time. Existing
 * rows from before the switch still need a one-shot backfill or campaign
 * segmentation (`contacts.has_whatsapp = true`) will miss them.
 */
export class BackfillHasWhatsappFromHasPhone1781200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE contacts SET has_whatsapp = true WHERE has_phone = true AND has_whatsapp = false;`);
  }

  public async down(): Promise<void> {
    // No-op: we can't tell which rows were backfilled vs. legitimately true.
  }
}
