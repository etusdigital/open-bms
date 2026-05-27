import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeCampaignsColumnsTypes1667481814942 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE campaigns ALTER COLUMN schedule_to type timestamp without time zone USING schedule_to::timestamp');
    await queryRunner.query('ALTER TABLE campaigns ALTER COLUMN testab_schedule_to type timestamp without time zone USING testab_schedule_to::timestamp');
    await queryRunner.query('ALTER TABLE campaigns ALTER COLUMN testab_schedule_end type timestamp without time zone USING testab_schedule_end::timestamp');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE campaigns ALTER COLUMN schedule_to type varchar(255) USING schedule_to::varchar');
    await queryRunner.query('ALTER TABLE campaigns ALTER COLUMN testab_schedule_to type varchar(255) USING testab_schedule_to::varchar');
    await queryRunner.query('ALTER TABLE campaigns ALTER COLUMN testab_schedule_end type varchar(255) USING testab_schedule_end::varchar');
  }
}
