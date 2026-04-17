import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class createTableAutomationsMessagesAccounts1616787844434 implements MigrationInterface {
  private table = new Table({
    name: 'automation_message_account',
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
        name: 'automation_message_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'test_id',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'provider_account_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'provider',
        type: 'varchar',
        length: '20',
        isNullable: true,
      },
      {
        name: 'created_at',
        type: 'TIMESTAMP',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'updated_at',
        type: 'TIMESTAMP',
        isNullable: true,
        onUpdate: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'deleted_at',
        type: 'TIMESTAMP',
        isNullable: true,
      },
    ],
  });
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'automation_message_account',
      new TableForeignKey({
        columnNames: ['automation_message_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'automations_message',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'automation_message_account',
      new TableIndex({
        name: 'automation_message_id_automation_message_account',
        columnNames: ['automation_message_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
