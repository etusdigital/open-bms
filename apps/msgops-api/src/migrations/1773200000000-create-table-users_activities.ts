import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class createTableUsersActivities1773200000000 implements MigrationInterface {
  private table = new Table({
    name: 'users_activities',
    columns: [
      {
        name: 'id',
        type: 'integer',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'user_id',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'email',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'action',
        type: 'varchar',
        length: '50',
        isNullable: false,
      },
      {
        name: 'status',
        type: 'varchar',
        length: '20',
        isNullable: false,
      },
      {
        name: 'ip_address',
        type: 'varchar',
        length: '45',
        isNullable: true,
      },
      {
        name: 'user_agent',
        type: 'varchar',
        length: '500',
        isNullable: true,
      },
      {
        name: 'headers',
        type: 'jsonb',
        isNullable: true,
      },
      {
        name: 'created_at',
        type: 'timestamptz',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);

    await queryRunner.createForeignKey(
      'users_activities',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'users_activities',
      new TableIndex({
        name: 'idx_users_activities_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'users_activities',
      new TableIndex({
        name: 'idx_users_activities_email',
        columnNames: ['email'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users_activities');
  }
}
