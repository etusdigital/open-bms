import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterContactsAddSmsColumns1686682474369 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'sms_last_sent',
      type: 'date',
      isNullable: true,
    }),
    new TableColumn({
      name: 'sms_last_delivered',
      type: 'date',
      isNullable: true,
    }),
    new TableColumn({
      name: 'sms_last_click',
      type: 'date',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts', this.columns);
  }
}
