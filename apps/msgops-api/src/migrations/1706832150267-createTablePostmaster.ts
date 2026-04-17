import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class createTablePostmaster1706821225626 implements MigrationInterface {
  private table = new Table({
    name: 'postmaster',
    columns: [
      {
        name: 'time',
        type: 'timestamp with time zone',
        isNullable: false,
      },
      {
        name: 'date',
        type: 'date',
        isNullable: false,
      },
      {
        name: 'domain',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },

      {
        name: 'ip',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'reputation',
        type: 'varchar',
        length: '20',
        isNullable: true,
      },
      {
        name: 'domain_reputation',
        type: 'varchar',
        length: '20',
        isNullable: true,
      },
      {
        name: 'user_reported_spam_ratio',
        type: 'decimal',
        isNullable: true,
      },
      {
        name: 'spf_success_ratio',
        type: 'decimal',
        isNullable: true,
      },
      {
        name: 'dkim_success_ratio',
        type: 'decimal',
        isNullable: true,
      },
      {
        name: 'dmarc_success_ratio',
        type: 'decimal',
        isNullable: true,
      },
      {
        name: 'inbound_encryption_ratio',
        type: 'decimal',
        isNullable: true,
      },
      {
        name: 'delivery_errors',
        type: 'jsonb',
        isNullable: true,
      },
      {
        name: 'spam_feedback_loops',
        type: 'jsonb',
        isNullable: true,
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createIndex(
      'postmaster',
      new TableIndex({
        name: 'index_domain_postmaster',
        columnNames: ['domain'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
