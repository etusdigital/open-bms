import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class createTableLeads1711462210972 implements MigrationInterface {
  private table = new Table({
    name: 'leads',
    columns: [
      {
        name: 'id',
        type: 'bigint',
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
        name: 'uuid',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'transaction_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
      },
      {
        name: 'email',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'hashed_email',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'email_provider',
        type: 'varchar',
        length: '40',
        isNullable: true,
      },
      {
        name: 'phone',
        type: 'varchar',
        length: '40',
        isNullable: true,
      },
      {
        name: 'first_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'last_name',
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
        name: 'clid',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'ad_id',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'adgroup_id',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'adset_id',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'placement',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'campaign_id',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'utm_source',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'utm_medium',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'utm_content',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'utm_campaign',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'utm_term',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'utm_keyword',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'questions',
        type: 'jsonb',
        isNullable: true,
      },
      {
        name: 'forms',
        type: 'jsonb',
        isNullable: true,
      },
      {
        name: 'query_string',
        type: 'jsonb',
        isNullable: true,
      },
      {
        name: 'is_valid',
        type: 'boolean',
        default: false,
      },
      {
        name: 'invalid_reason',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'lead_source',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'custom_fields',
        type: 'jsonb',
        isNullable: true,
      },
      {
        name: 'source_url',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'direct_to_url',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'user_agent',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'engaged',
        type: 'varchar',
        length: '50',
        isNullable: true,
      },
      {
        name: 'status',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'tag_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'automation_id',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'automation_title',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'automation_status',
        type: 'varchar',
        length: '20',
        isNullable: true,
      },
      {
        name: 'created_at',
        type: 'timestamptz',
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
        type: 'timestamptz',
        isNullable: true,
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'leads',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'leads',
      new TableForeignKey({
        columnNames: ['automation_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'automations',
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createIndex(
      'leads',
      new TableIndex({
        name: 'index_leads_created_at_date',
        columnNames: ['account_id', 'created_at_date'],
      }),
    );
    await queryRunner.createIndex(
      'leads',
      new TableIndex({
        name: 'index_leads_status',
        columnNames: ['account_id', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'leads',
      new TableIndex({
        name: 'index_leads_email',
        columnNames: ['account_id', 'email'],
      }),
    );
    await queryRunner.createIndex(
      'leads',
      new TableIndex({
        name: 'index_leads_contact_status',
        columnNames: ['account_id', 'status', 'automation_status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('leads');
  }
}
