import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

export class createTableSuppressions1724866525638 implements MigrationInterface {
  private suppressionsTable = new Table({
    name: 'suppressions',
    columns: [
      {
        name: 'id',
        type: 'integer',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'group_id',
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
        name: 'is_unsubscribed',
        type: 'boolean',
        isNullable: false,
        default: true,
      },
      {
        name: 'unsubscribed_at',
        type: 'timestamptz',
        isNullable: true,
      },
      {
        name: 'is_blocked',
        type: 'boolean',
        isNullable: false,
        default: false,
      },
      {
        name: 'blocked_at',
        type: 'timestamptz',
        isNullable: true,
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.suppressionsTable);
    await queryRunner.createIndex(
      'suppressions',
      new TableIndex({
        name: 'index_suppressions_email',
        columnNames: ['email', 'group_id'],
      }),
    );
    await queryRunner.createUniqueConstraint(
      'suppressions',
      new TableUnique({
        name: 'suppressions_email_group_unique',
        columnNames: ['email', 'group_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.suppressionsTable);
  }
}
