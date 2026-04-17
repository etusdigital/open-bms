import { MigrationInterface, QueryRunner } from 'typeorm';

export class changeCampaignsJsonColumnsToJsonb1694610257364 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE campaigns ALTER COLUMN steps SET DATA TYPE jsonb;`);
    await queryRunner.query(`ALTER TABLE campaigns ALTER COLUMN tags SET DATA TYPE jsonb;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE campaigns ALTER COLUMN steps SET DATA TYPE json;`);
    await queryRunner.query(`ALTER TABLE campaigns ALTER COLUMN tags SET DATA TYPE json;`);
  }
}
