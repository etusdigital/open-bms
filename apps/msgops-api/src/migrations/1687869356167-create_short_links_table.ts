import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class createShortLinksTable1687869356167 implements MigrationInterface {
  private table = new Table({
    name: 'short_links',
    columns: [
      {
        name: 'short_code',
        type: 'varchar',
        length: '10',
        isUnique: true,
        isNullable: false,
      },
      {
        name: 'long_url',
        type: 'text',
        isNullable: false,
      },
      {
        name: 'created_at',
        type: 'timestamp with time zone',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createIndex(
      'short_links',
      new TableIndex({
        name: 'index_short_links_code',
        columnNames: ['short_code'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
