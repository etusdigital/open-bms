import { MigrationInterface, QueryRunner } from 'typeorm';

export class createTableSegmentProcess1778784000000 implements MigrationInterface {
  name = 'createTableSegmentProcess1778784000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS segment_process (
        tag_id INTEGER NOT NULL,
        contact_id INTEGER NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_segment_process_tag_id ON segment_process(tag_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS segment_process`);
  }
}
