import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addSettingsToUsers1663772975911 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'settings',
      type: 'JSON',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('users', this.columns);
  }
}
