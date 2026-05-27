import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterAutomationsAddFlowLayout1774500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE automations ADD COLUMN flow_layout jsonb DEFAULT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE automations DROP COLUMN IF EXISTS flow_layout`);
  }
}
