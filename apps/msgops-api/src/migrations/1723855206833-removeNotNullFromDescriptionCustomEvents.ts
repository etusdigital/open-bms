import { MigrationInterface, QueryRunner } from 'typeorm';

export class removeNotNullFromDescriptionCustomEvents1723855206833 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE custom_events ALTER COLUMN description DROP NOT NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE custom_events ALTER COLUMN description SET NOT NULL');
  }
}
