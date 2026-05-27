import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class createTableAudits1636649524392 implements MigrationInterface {
  private table = new Table({
    name: 'audits',
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
        name: 'entity',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'entity_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'type',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'old_values',
        type: 'json',
        isNullable: true,
      },
      {
        name: 'new_values',
        type: 'json',
        isNullable: true,
      },
      {
        name: 'user',
        type: 'varchar',
        length: '600',
        isNullable: true,
      },
      {
        name: 'ip_address',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'user_agent',
        type: 'varchar',
        length: '600',
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
      'audits',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'audits',
      new TableIndex({
        name: 'entity_id_audits',
        columnNames: ['entity_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
