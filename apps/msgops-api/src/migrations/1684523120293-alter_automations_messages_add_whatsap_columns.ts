import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAutomationsMessagesAddWhatsappColumns1684523120291 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'status',
      type: 'varchar',
      length: '50',
      isNullable: true,
    }),
    new TableColumn({
      name: 'whatsapp_type',
      type: 'varchar',
      length: '50',
      isNullable: true,
    }),
    new TableColumn({
      name: 'call_to_action_text',
      type: 'varchar',
      length: '100',
      isNullable: true,
    }),
    new TableColumn({
      name: 'provider_message_id',
      type: 'varchar',
      length: '100',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('automations_message', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('automations_message', this.columns);
  }
}
