import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterContactsAddWhatsappColumns1686682474369 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'whatsapp',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'has_whatsapp',
      type: 'boolean',
      isNullable: false,
      default: false,
    }),
    new TableColumn({
      name: 'whatsapp_last_sent',
      type: 'date',
      isNullable: true,
    }),
    new TableColumn({
      name: 'whatsapp_last_delivered',
      type: 'date',
      isNullable: true,
    }),
    new TableColumn({
      name: 'whatsapp_last_open',
      type: 'date',
      isNullable: true,
    }),
    new TableColumn({
      name: 'whatsapp_last_click',
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
