import { MigrationInterface, QueryRunner } from 'typeorm';

export class dropCustomEventsAndVerify1780000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('custom_events')) {
      await queryRunner.query('DROP TABLE IF EXISTS custom_events CASCADE');
    }
    if (await queryRunner.hasTable('verify_statistics')) {
      await queryRunner.query('DROP TABLE IF EXISTS verify_statistics CASCADE');
    }
    if (await queryRunner.hasTable('events_statistics')) {
      if (await queryRunner.hasColumn('events_statistics', 'events_count')) {
        await queryRunner.dropColumn('events_statistics', 'events_count');
      }
      if (await queryRunner.hasColumn('events_statistics', 'events_unique')) {
        await queryRunner.dropColumn('events_statistics', 'events_unique');
      }
    }
  }

  public async down(): Promise<void> {
    // Irreversible: feature removal as part of OSS launch (EVO-1446).
  }
}
