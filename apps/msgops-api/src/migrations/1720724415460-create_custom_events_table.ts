import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique, TableIndex } from 'typeorm';

export class createCustomEvents1720724415460 implements MigrationInterface {
  private table = new Table({
    name: 'custom_events',
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
        name: 'name',
        type: 'varchar',
        length: '40',
        isNullable: false,
      },
      {
        name: 'description',
        type: 'varchar',
        length: '500',
        isNullable: false,
      },
      {
        name: 'is_default',
        type: 'boolean',
        isNullable: false,
        default: false,
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
      'custom_events',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createUniqueConstraint(
      'custom_events',
      new TableUnique({
        name: 'custom_event_name_unique',
        columnNames: ['name', 'account_id'],
      }),
    );
    await queryRunner.createIndex(
      'custom_events',
      new TableIndex({
        name: 'index_custom_event_name',
        columnNames: ['name'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
