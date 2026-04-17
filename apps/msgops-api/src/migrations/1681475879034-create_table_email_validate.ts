import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class createTableEmailValidate1681475879034 implements MigrationInterface {
  private table = new Table({
    name: 'email_validations',
    columns: [
      {
        name: 'email',
        type: 'varchar',
        length: '255',
        isUnique: true,
        isNullable: false,
      },
      {
        name: 'status',
        type: 'varchar',
        length: '50',
        isNullable: true,
      },
      {
        name: 'reason',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'response',
        type: 'text',
        isNullable: false,
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
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createIndex(
      'email_validations',
      new TableIndex({
        name: 'index_email_validations_email',
        columnNames: ['email'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
