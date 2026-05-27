import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAutomationsMessagesAddExpiryPush1681910643139 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'expiry_push_in_seconds',
      type: 'int',
      isNullable: true,
    }),
    new TableColumn({
      name: 'expiry_push_filter',
      type: 'varchar',
      length: '20',
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
