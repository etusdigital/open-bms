import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTagsDerivedColumns1777593600000 implements MigrationInterface {
  name = 'DropTagsDerivedColumns1777593600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tags" DROP COLUMN IF EXISTS "query"');
    await queryRunner.query('ALTER TABLE "tags" DROP COLUMN IF EXISTS "external_query_steps"');
  }

  // Intentional no-op: `tags.query` and `tags.external_query_steps` are
  // derived from `tags.steps` and no longer exist as entity columns, so
  // there is nothing meaningful to restore here. To revert this change,
  // `git revert` the PR — the columns will be re-added by their original
  // entity decorators on the previous commit. Returning instead of
  // throwing keeps `migration:revert` and rollback automation usable for
  // newer migrations stacked on top.
  public async down(): Promise<void> {
    return;
  }
}
