import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

export class createTableContactsDevices1672863210801 implements MigrationInterface {
  private table = new Table({
    name: 'contacts_devices',
    columns: [
      {
        name: 'id',
        type: 'integer',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'account_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'contact_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'type',
        type: 'varchar',
        length: '40',
        isNullable: false,
      },
      {
        name: 'is_active',
        type: 'boolean',
        default: true,
        isNullable: false,
      },
      {
        name: 'token',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'is_unsubscribed',
        type: 'boolean',
        isNullable: false,
        default: false,
      },
      {
        name: 'ip',
        type: 'varchar',
        length: '50',
        isNullable: true,
      },
      {
        name: 'device_type',
        type: 'varchar',
        length: '60',
        isNullable: true,
      },
      {
        name: 'os',
        type: 'varchar',
        length: '60',
        isNullable: true,
      },
      {
        name: 'browser',
        type: 'varchar',
        length: '50',
        isNullable: true,
      },
      {
        name: 'browser_version',
        type: 'varchar',
        length: '50',
        isNullable: true,
      },
      {
        name: 'resolution',
        type: 'varchar',
        length: '50',
        isNullable: true,
      },
      {
        name: 'subscription_url',
        type: 'varchar',
        length: '400',
        isNullable: true,
      },
      {
        name: 'latest_visited_url',
        type: 'varchar',
        length: '400',
        isNullable: true,
      },
      {
        name: 'last_session',
        type: 'timestamptz',
        isNullable: true,
      },
      {
        name: 'last_sent',
        type: 'timestamptz',
        isNullable: true,
      },
      {
        name: 'last_sent_date',
        type: 'date',
        isNullable: true,
      },
      {
        name: 'last_view',
        type: 'timestamptz',
        isNullable: true,
      },
      {
        name: 'last_view_date',
        type: 'timestamptz',
        isNullable: true,
      },
      {
        name: 'last_click',
        type: 'timestamptz',
        isNullable: true,
      },
      {
        name: 'last_click_date',
        type: 'timestamptz',
        isNullable: true,
      },
      {
        name: 'created_at',
        type: 'TIMESTAMPTZ',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'updated_at',
        type: 'TIMESTAMPTZ',
        isNullable: true,
        onUpdate: 'CURRENT_TIMESTAMP',
      },
    ],
  });
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'contacts_devices',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createUniqueConstraint(
      'contacts_devices',
      new TableUnique({
        name: 'contacts_devices_unique',
        columnNames: ['account_id', 'contact_id', 'token'],
      }),
    );
    await queryRunner.createIndex(
      'contacts_devices',
      new TableIndex({
        name: 'index_contacts_devices_is_active',
        columnNames: ['account_id', 'is_active'],
      }),
    );
    await queryRunner.createIndex(
      'contacts_devices',
      new TableIndex({
        name: 'index_contacts_devices_last_sent',
        columnNames: ['account_id', 'last_sent_date'],
      }),
    );
    await queryRunner.createIndex(
      'contacts_devices',
      new TableIndex({
        name: 'index_contacts_devices_last_click',
        columnNames: ['account_id', 'last_click_date'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
