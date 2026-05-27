import { MigrationInterface, TableColumn, QueryRunner } from 'typeorm';

export class addIsActiveToContactsTags1722953664502 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'is_active',
      type: 'boolean',
      default: true,
      isNullable: false,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts_tags', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('contacts_tags', this.columns);
  }
}
