import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Copies `phone` to the (previously dedicated) `whatsapp` column for every
 * contact that has a phone but an empty whatsapp field. send-whatsapp's
 * AppService.processCampaign() reads `contact.whatsapp` (not phone) as the
 * destination — without this copy, every campaign silently no-ops with
 * `skipped: 'no whatsapp on contact'`.
 *
 * The Evolution integration used to populate `whatsapp` after the number
 * check; with WhatsApp Cloud there is no check, so we just mirror `phone`.
 * The contact entity's BeforeInsert/BeforeUpdate hook now keeps the two
 * columns in sync for new/updated rows.
 */
export class BackfillContactsWhatsappFromPhone1781300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE contacts SET whatsapp = phone WHERE phone IS NOT NULL AND phone <> '' AND (whatsapp IS NULL OR whatsapp = '');`);
  }

  public async down(): Promise<void> {
    // No-op: we can't tell which rows were backfilled vs. originally populated.
  }
}
