import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

export class createTableAccountsUsages1681475849726 implements MigrationInterface {
  private table = new Table({
    name: 'accounts_usages',
    columns: [
      {
        name: 'account_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'service',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'date',
        type: 'date',
        isNullable: false,
      },
      {
        name: 'count',
        type: 'integer',
        isNullable: false,
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createIndex(
      'accounts_usages',
      new TableIndex({
        name: 'index_accounts_usages_account_id',
        columnNames: ['account_id'],
      }),
    );
    await queryRunner.createIndex(
      'accounts_usages',
      new TableIndex({
        name: 'index_accounts_usages_account_id_',
        columnNames: ['account_id', 'date'],
      }),
    );
    await queryRunner.createUniqueConstraint(
      'accounts_usages',
      new TableUnique({
        name: 'account_date_unique',
        columnNames: ['account_id', 'date', 'service'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
