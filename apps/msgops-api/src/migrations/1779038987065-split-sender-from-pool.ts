import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitSenderFromPool1779038987065 implements MigrationInterface {
  name = 'SplitSenderFromPool1779038987065';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS senders (
        id SERIAL PRIMARY KEY,
        sender_email VARCHAR(255) NOT NULL,
        sender_name VARCHAR(60) NOT NULL,
        sender_replyto_email VARCHAR(255),
        sending_limit INTEGER,
        account_id INTEGER NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        sg_verified_sender_id VARCHAR(255),
        removed_at_source TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_senders_account_email ON senders(account_id, sender_email)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_senders_account_sg_id ON senders(account_id, sg_verified_sender_id)
    `);

    await queryRunner.query(`
      ALTER TABLE pools
        DROP COLUMN IF EXISTS sender_email,
        DROP COLUMN IF EXISTS sender_name,
        DROP COLUMN IF EXISTS sender_replyto_email
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Forward-fix only (D13): down() recreates columns structurally but does
    // NOT restore data. The split runbook is deploy → migration → sync.
    await queryRunner.query(`
      ALTER TABLE pools
        ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS sender_name VARCHAR(60),
        ADD COLUMN IF NOT EXISTS sender_replyto_email VARCHAR(255)
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS senders`);
  }
}
