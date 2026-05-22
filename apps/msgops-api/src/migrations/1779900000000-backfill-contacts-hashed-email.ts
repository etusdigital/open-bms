import { MigrationInterface, QueryRunner } from 'typeorm';

// Backfills `contacts.hashed_email` for rows where it was never set.
//
// Same root cause as 1779800000000 (email_provider): contacts saved via a
// plain object literal bypassed the `@BeforeInsert` listener, so
// `hashed_email` — set in the same block as `email_provider` — was also
// left NULL. The save call sites now use `repository.create()`; this fixes
// the rows already persisted without the hash.
//
// `encode(sha256(convert_to(lower(email), 'UTF8')), 'hex')` is verified to
// produce byte-identical output to `ContactEntity.setUserDetails`'
// `createHash('sha256').update(email.toLowerCase()).digest('hex')`.
// `sha256()` is a Postgres 11+ built-in — no pgcrypto extension needed.
export class BackfillContactsHashedEmail1779900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE contacts
      SET hashed_email = encode(sha256(convert_to(lower(email), 'UTF8')), 'hex')
      WHERE email IS NOT NULL
        AND email <> ''
        AND (hashed_email IS NULL OR hashed_email = '')
    `);
  }

  // Intentional no-op: the backfilled hash is indistinguishable from one a
  // correct insert would have produced, and the pre-migration state
  // (NULL/empty) carried no information. To revert, `git revert` the PR.
  public async down(): Promise<void> {
    return;
  }
}
