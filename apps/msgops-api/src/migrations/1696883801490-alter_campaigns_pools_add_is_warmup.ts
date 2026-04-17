import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterCampaignsPoolsAddWarmup1696346367543 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'is_warmup',
      type: 'boolean',
      default: false,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('pools', this.columns);
    await queryRunner.addColumns('campaigns', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('pools', this.columns);
    await queryRunner.dropColumns('campaigns', this.columns);
  }
}
