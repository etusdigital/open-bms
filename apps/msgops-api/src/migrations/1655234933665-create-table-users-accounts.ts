import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class createTableUsersAccounts1655234933665 implements MigrationInterface {
  private table = new Table({
    name: 'users_accounts',
    columns: [
      {
        name: 'user_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'account_id',
        type: 'integer',
        isNullable: false,
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'users_accounts',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'users_accounts',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createUniqueConstraint(
      'users_accounts',
      new TableUnique({
        name: 'user_account_unique',
        columnNames: ['user_id', 'account_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropTable('users_accounts');
  }
}
