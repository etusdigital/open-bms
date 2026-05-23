import { MigrationInterface, QueryRunner } from 'typeorm';

export class dropIsInternal1779950000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const accountsHas = await queryRunner.hasColumn('accounts', 'is_internal');
    if (accountsHas) {
      await queryRunner.dropColumn('accounts', 'is_internal');
    }
    const labelsTable = await queryRunner.hasTable('emails_labels');
    if (labelsTable) {
      const labelsHas = await queryRunner.hasColumn('emails_labels', 'is_internal');
      if (labelsHas) {
        await queryRunner.dropColumn('emails_labels', 'is_internal');
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false');
  }
}
