import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey, TableUnique } from 'typeorm';

export class createTableVerifyStatistics1749144353668 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'verify_statistics',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'account_id', type: 'integer', isNullable: false },
          { name: 'date', type: 'date', isNullable: false },
          { name: 'type', type: 'varchar', isNullable: false },
          { name: 'count_total', type: 'integer', isNullable: false },
          { name: 'count_success', type: 'integer', isNullable: false },
          { name: 'count_error', type: 'integer', isNullable: false },
          { name: 'count_verify_validated', type: 'integer', isNullable: false },
          { name: 'count_verify_rejected', type: 'integer', isNullable: false },
        ],
      }),
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'verify_statistics',
      new TableForeignKey({
        name: 'FK_verify_statistics_account_id',
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Create unique constraint
    await queryRunner.createUniqueConstraint(
      'verify_statistics',
      new TableUnique({
        name: 'verify_statistics_account_id_date_type_unique',
        columnNames: ['account_id', 'type', 'date'],
      }),
    );

    // Create indexes
    await queryRunner.createIndex('verify_statistics', new TableIndex({ name: 'idx_verify_statistics_account_date', columnNames: ['account_id', 'date'] }));
    await queryRunner.createIndex('verify_statistics', new TableIndex({ name: 'idx_verify_statistics_date', columnNames: ['date'] }));
    await queryRunner.createIndex('verify_statistics', new TableIndex({ name: 'idx_verify_statistics_type', columnNames: ['type'] }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('verify_statistics', 'FK_verify_statistics_account_id');
    await queryRunner.dropUniqueConstraint('verify_statistics', 'verify_statistics_account_id_date_type_unique');
    await queryRunner.dropIndex('verify_statistics', 'idx_verify_statistics_account_date');
    await queryRunner.dropIndex('verify_statistics', 'idx_verify_statistics_date');
    await queryRunner.dropIndex('verify_statistics', 'idx_verify_statistics_type');
    await queryRunner.dropTable('verify_statistics');
  }
}
