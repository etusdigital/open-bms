import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAccountsConfigsAddIsLoadConfig1710416620175 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'is_load_config',
      type: 'boolean',
      default: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('accounts_configs', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('accounts_configs', this.columns);
  }
}
