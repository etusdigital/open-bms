import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterContactsDevicesAddDelivered1676565002514 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'last_delivered',
      type: 'timestamptz',
      isNullable: true,
    }),
    new TableColumn({
      name: 'last_delivered_date',
      type: 'date',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts_devices', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('contacts_devices', this.columns);
  }
}
