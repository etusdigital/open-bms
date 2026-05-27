import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterContactsAddLastAutomation1661965690307 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'last_automation',
      type: 'TIMESTAMP',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('contacts', this.columns);
  }
}
