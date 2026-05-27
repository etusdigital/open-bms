import { MigrationInterface, QueryRunner } from 'typeorm';

export class dropUsersProfileUnique1774800000002 implements MigrationInterface {
  name = 'dropUsersProfileUnique1774800000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drops the legacy UNIQUE(profile) constraint on users. Profile stores the avatar URL;
    // uniqueness makes no sense and blocks multi-user creation when several users share
    // the default empty-string avatar.
    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "UQ_e850707b5c70fa49ea50ef2f59f"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT "UQ_e850707b5c70fa49ea50ef2f59f" UNIQUE (profile)`);
  }
}
