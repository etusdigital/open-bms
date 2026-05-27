import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAccountsDropColumns1657819540838 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('accounts', 'default_domain');
    await queryRunner.dropColumn('accounts', 'domains');
    await queryRunner.dropColumn('accounts', 'default_sender_name');
    await queryRunner.dropColumn('accounts', 'default_sender_email');
    await queryRunner.dropColumn('accounts', 'default_address');
    await queryRunner.dropColumn('accounts', 'api_key');
    await queryRunner.dropColumn('accounts', 'sendgrid_key');
    await queryRunner.dropColumn('accounts', 'settings');
    await queryRunner.dropColumn('accounts', 'link_unsubscriber');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('accounts', new TableColumn({ name: 'default_domain', type: 'varchar', length: '255' }));
    await queryRunner.addColumn('accounts', new TableColumn({ name: 'domains', type: 'json' }));
    await queryRunner.addColumn('accounts', new TableColumn({ name: 'default_sender_name', type: 'varchar', length: '255' }));
    await queryRunner.addColumn('accounts', new TableColumn({ name: 'default_sender_email', type: 'varchar', length: '255' }));
    await queryRunner.addColumn('accounts', new TableColumn({ name: 'default_address', type: 'text' }));
    await queryRunner.addColumn('accounts', new TableColumn({ name: 'api_key', type: 'varchar', length: '255' }));
    await queryRunner.addColumn('accounts', new TableColumn({ name: 'sendgrid_key', type: 'varchar', length: '255' }));
    await queryRunner.addColumn('accounts', new TableColumn({ name: 'settings', type: 'json' }));
    await queryRunner.addColumn('accounts', new TableColumn({ name: 'link_unsubscriber', type: 'varchar', length: '500' }));
  }
}
