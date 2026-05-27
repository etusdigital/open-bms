import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterEventsStatisticsAddBotDatacenterClickCounters1776703279057 implements MigrationInterface {
  name = 'alterEventsStatisticsAddBotDatacenterClickCounters1776703279057';

  // Click-only aggregate counters. Opens are intentionally not aggregated —
  // Gmail/Apple-MPP/Outlook image proxies make prefetch-vs-real-read
  // indistinguishable at the IP layer. See
  // apps/event-process/docs/plans/2026-04-20-bot-detection-mmdb-refactor.md
  // decision 6.
  private columns = [
    new TableColumn({ name: 'bot_click', type: 'integer', default: 0, isNullable: false }),
    new TableColumn({ name: 'datacenter_click', type: 'integer', default: 0, isNullable: false }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('events_statistics', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('events_statistics', this.columns);
  }
}
