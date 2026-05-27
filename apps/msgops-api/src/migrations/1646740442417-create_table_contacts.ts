import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

export class createTableContacts1646740442417 implements MigrationInterface {
  private table = new Table({
    name: 'contacts',
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
        name: 'email',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'email_provider',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'first_name',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'last_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'hashed_email',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'phone',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'city',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'region',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'country',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'postal',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'ip',
        type: 'varchar',
        length: '50',
        isNullable: true,
      },
      {
        name: 'latitude',
        type: 'DECIMAL(10,7)',
        isNullable: true,
      },
      {
        name: 'longitude',
        type: 'DECIMAL(10,7)',
        isNullable: true,
      },
      {
        name: 'timezone',
        type: 'varchar',
        length: '100',
        isNullable: true,
      },
      {
        name: 'is_active',
        type: 'boolean',
        isNullable: false,
        default: true,
      },
      {
        name: 'is_unsubscribed',
        type: 'boolean',
        isNullable: false,
        default: false,
      },
      {
        name: 'has_bounced',
        type: 'boolean',
        isNullable: false,
        default: false,
      },
      {
        name: 'last_open',
        type: 'TIMESTAMP',
        isNullable: true,
      },
      {
        name: 'last_click',
        type: 'TIMESTAMP',
        isNullable: true,
      },
      {
        name: 'last_sent',
        type: 'TIMESTAMP',
        isNullable: true,
      },
      {
        name: 'custom_fields',
        type: 'jsonb',
        isNullable: true,
      },
      {
        name: 'score',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'score_forecast',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'created_at',
        type: 'TIMESTAMP',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'created_at_date',
        type: 'DATE',
        isNullable: false,
        default: 'CURRENT_DATE',
      },
      {
        name: 'updated_at',
        type: 'TIMESTAMP',
        isNullable: true,
        onUpdate: 'CURRENT_TIMESTAMP',
      },
    ],
  });
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'contacts',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'contacts',
      new TableIndex({
        name: 'index_contacts_is_unsubscribed',
        columnNames: ['is_unsubscribed'],
      }),
    );
    await queryRunner.createIndex(
      'contacts',
      new TableIndex({
        name: 'index_contacts_created_at_date',
        columnNames: ['created_at_date'],
      }),
    );
    await queryRunner.createIndex(
      'contacts',
      new TableIndex({
        name: 'index_contacts_email_provider',
        columnNames: ['email_provider'],
      }),
    );
    await queryRunner.createIndex(
      'contacts',
      new TableIndex({
        name: 'index_contacts_first_name',
        columnNames: ['first_name'],
      }),
    );
    await queryRunner.createIndex(
      'contacts',
      new TableIndex({
        name: 'index_contacts_last_name',
        columnNames: ['last_name'],
      }),
    );
    await queryRunner.createUniqueConstraint(
      'contacts',
      new TableUnique({
        name: 'contact_email_unique',
        columnNames: ['email', 'hashed_email', 'account_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropDatabase('contacts');
  }
}
