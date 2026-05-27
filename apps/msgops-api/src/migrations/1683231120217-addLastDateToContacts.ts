import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addLastDateToContacts1683231120217 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'last_open_date',
      type: 'date',
      isNullable: true,
    }),
    new TableColumn({
      name: 'last_click_date',
      type: 'date',
      isNullable: true,
    }),
    new TableColumn({
      name: 'last_sent_date',
      type: 'date',
      isNullable: true,
    }),
    new TableColumn({
      name: 'last_automation_date',
      type: 'date',
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
