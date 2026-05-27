import { MigrationInterface, QueryRunner } from 'typeorm';

// Backfills `contacts.email_provider` for rows where it was never set.
//
// Root cause: ContactsService created contacts via
// `contactRepository.save({ ...plainObject })`. TypeORM only fires the
// `@BeforeInsert` listener (`ContactEntity.setUserDetails`) when the saved
// value is a class instance — a plain object literal bypasses it, so
// `email_provider` (and `hashed_email`) were never populated. The save
// call sites now use `repository.create()`; this migration fixes the rows
// already persisted without the provider.
//
// The CASE mirrors `ContactEntity.getMailBoxProvider`: exact-match domains
// for Gmail/iCloud, substring match for Yahoo/Microsoft, `Other` otherwise.
export class BackfillContactsEmailProvider1779800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE contacts
      SET email_provider = CASE
        WHEN split_part(lower(email), '@', 2) IN ('gmail.com', 'googlemail.com', 'google.com') THEN 'Gmail'
        WHEN split_part(lower(email), '@', 2) LIKE '%yahoo%' THEN 'Yahoo'
        WHEN split_part(lower(email), '@', 2) LIKE '%hotmail.com%'
          OR split_part(lower(email), '@', 2) LIKE '%outlook.com%'
          OR split_part(lower(email), '@', 2) LIKE '%live.com%'
          OR split_part(lower(email), '@', 2) LIKE '%msn.com%'
          OR split_part(lower(email), '@', 2) LIKE '%passport.com%' THEN 'Microsoft'
        WHEN split_part(lower(email), '@', 2) IN ('icloud.com', 'me.com', 'mac.com') THEN 'iCloud'
        ELSE 'Other'
      END
      WHERE email IS NOT NULL
        AND email <> ''
        AND (email_provider IS NULL OR email_provider = '')
    `);
  }

  // Intentional no-op: the backfilled rows are indistinguishable from rows
  // a correct insert would have produced, and the pre-migration state
  // (NULL/empty) carried no information. To revert, `git revert` the PR.
  public async down(): Promise<void> {
    return;
  }
}
