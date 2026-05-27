import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

export class alterContactsDevicesAddUnique1727219530887 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint('contacts_devices', 'contacts_devices_unique');
    await queryRunner.createUniqueConstraint(
      'contacts_devices',
      new TableUnique({
        name: 'contacts_devices_unique',
        columnNames: ['account_id', 'token'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createUniqueConstraint(
      'contacts_devices',
      new TableUnique({
        name: 'contacts_devices_unique',
        columnNames: ['account_id', 'contact_id', 'token'],
      }),
    );
  }
}
