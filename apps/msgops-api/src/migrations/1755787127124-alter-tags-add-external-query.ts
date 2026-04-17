import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterCampaignsAddExternalQuery1755787127124 implements MigrationInterface {
  private newColumns = new TableColumn({
    name: 'external_query_steps',
    type: 'json',
    isNullable: true,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('tags', this.newColumns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tags', this.newColumns);
  }
}
