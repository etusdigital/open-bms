import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class createTableApiKeyAuditLogs1774540800000 implements MigrationInterface {
  name = 'createTableApiKeyAuditLogs1774540800000';

  private table = new Table({
    name: 'api_key_audit_logs',
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
        name: 'user_id',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'user_email',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'action',
        type: 'varchar',
        length: '50',
        isNullable: false,
        comment: 'REQUEST, CONFIRM, CONFIRM_EXPIRED, CONFIRM_INVALID, RATE_LIMITED',
      },
      {
        name: 'key_type',
        type: 'varchar',
        length: '50',
        isNullable: false,
        comment: 'api_key or api_key_tracker',
      },
      {
        name: 'token',
        type: 'varchar',
        length: '64',
        isNullable: true,
        comment: '2FA token sent via email',
      },
      {
        name: 'ip_address',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'user_agent',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'old_key_prefix',
        type: 'varchar',
        length: '8',
        isNullable: true,
        comment: 'First 8 chars of replaced key',
      },
      {
        name: 'new_key_prefix',
        type: 'varchar',
        length: '8',
        isNullable: true,
        comment: 'First 8 chars of new key',
      },
      {
        name: 'success',
        type: 'boolean',
        isNullable: false,
        default: true,
      },
      {
        name: 'metadata',
        type: 'json',
        isNullable: true,
        comment: 'Extra context: IP mismatch, error reason, etc.',
      },
      {
        name: 'created_at',
        type: 'TIMESTAMP',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'api_key_audit_logs',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'api_key_audit_logs',
      new TableIndex({
        name: 'idx_api_key_audit_account_id',
        columnNames: ['account_id'],
      }),
    );
    await queryRunner.createIndex(
      'api_key_audit_logs',
      new TableIndex({
        name: 'idx_api_key_audit_user_id',
        columnNames: ['user_id'],
      }),
    );
    await queryRunner.createIndex(
      'api_key_audit_logs',
      new TableIndex({
        name: 'idx_api_key_audit_action',
        columnNames: ['action'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('api_key_audit_logs');
  }
}
