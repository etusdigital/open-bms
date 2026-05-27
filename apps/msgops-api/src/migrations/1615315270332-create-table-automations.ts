import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

export class createTableAutomations1615315270332 implements MigrationInterface {
  private table = new Table({
    name: 'automations',
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
        name: 'title',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'active',
        type: 'boolean',
        isNullable: false,
        default: true,
      },
      {
        name: 'audience_id_external',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'audience_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'message_id',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'type',
        type: 'varchar',
        length: '50',
        isNullable: false,
        default: `'sunset'`,
      },
      {
        name: 'version',
        type: 'varchar',
        length: '20',
        isNullable: false,
        default: '0',
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
      'automations',
      new TableForeignKey({
        columnNames: ['message_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'automations_message',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'automations',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'automations',
      new TableIndex({
        name: 'message_id_automations',
        columnNames: ['message_id'],
      }),
    );
    await queryRunner.createUniqueConstraint(
      'automations',
      new TableUnique({
        name: 'automations_name_unique',
        columnNames: ['name', 'account_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
