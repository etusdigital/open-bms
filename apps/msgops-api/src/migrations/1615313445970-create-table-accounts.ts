import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class createTableAccounts1615313445970 implements MigrationInterface {
  private table = new Table({
    name: 'accounts',
    columns: [
      {
        name: 'id',
        type: 'integer',
        isPrimary: true,
        isGenerated: true, // Auto-increment
        generationStrategy: 'increment',
      },
      {
        name: 'name',
        type: 'varchar',
        length: '255',
        isUnique: true,
        isNullable: false,
      },
      {
        name: 'description',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'default_domain',
        type: 'varchar',
        length: '255',
        isUnique: true,
        isNullable: false,
      },
      {
        name: 'domains',
        type: 'json',
        isNullable: true,
      },
      {
        name: 'default_sender_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'default_sender_email',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'default_address',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'api_key',
        type: 'varchar',
        length: '255',
        isUnique: true,
        isNullable: true,
      },
      {
        name: 'sendgrid_key',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'settings',
        type: 'json',
        isNullable: true,
      },
      {
        name: 'link_unsubscriber',
        type: 'varchar',
        length: '500',
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
