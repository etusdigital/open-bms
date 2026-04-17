import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterCampaignsAddTestAbColumns1665406728747 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'type',
      type: 'varchar',
      length: '30',
      isNullable: true,
    }),
    new TableColumn({
      name: 'testab_schedule_to',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'testab_schedule_end',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'testab_audience_percent',
      type: 'integer',
      isNullable: true,
    }),
    new TableColumn({
      name: 'testab_criteria',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'testab_sent_after_test',
      type: 'boolean',
      default: false,
    }),
    new TableColumn({
      name: 'testab_schedule_to_cloud_task_id',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'testab_schedule_end_cloud_task_id',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'testab_last_id',
      type: 'integer',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('campaigns', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('campaigns', this.columns);
  }
}
