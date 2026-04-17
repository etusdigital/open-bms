import { MigrationInterface, QueryRunner, TableColumn, TableIndex, TableUnique } from 'typeorm';

export class alterTableVerifyStatiticsAddGroupColumn1749840573055 implements MigrationInterface {
  name = 'alterTableVerifyStatiticsAddGroupColumn1749840573055';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('verify_statistics');
    if (table) {
      await queryRunner.addColumn(
        table,
        new TableColumn({
          name: 'group',
          type: 'varchar',
          isNullable: true,
          default: "'default'",
        }),
      );
    }

    await queryRunner.dropUniqueConstraint('verify_statistics', 'verify_statistics_account_id_date_type_unique');
    await queryRunner.createUniqueConstraint(
      'verify_statistics',
      new TableUnique({ name: 'verify_statistics_account_id_date_type_group_unique', columnNames: ['account_id', 'date', 'type', 'group'] }),
    );

    await queryRunner.query(`UPDATE verify_statistics SET "group" = 'default' WHERE "group" IS NULL`);
    await queryRunner.query(`ALTER TABLE verify_statistics ALTER COLUMN "group" SET NOT NULL`);

    await queryRunner.createIndex('verify_statistics', new TableIndex({ name: 'idx_verify_statistics_account_group', columnNames: ['account_id', 'group'] }));
    await queryRunner.createIndex('verify_statistics', new TableIndex({ name: 'idx_verify_statistics_group', columnNames: ['group'] }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('verify_statistics');
    if (table) {
      await queryRunner.dropColumn(table, 'group');
    }

    await queryRunner.dropUniqueConstraint('verify_statistics', 'verify_statistics_account_id_date_type_group_unique');
    await queryRunner.createUniqueConstraint(
      'verify_statistics',
      new TableUnique({ name: 'verify_statistics_account_id_date_type_unique', columnNames: ['account_id', 'date', 'type'] }),
    );

    await queryRunner.dropIndex('verify_statistics', 'idx_verify_statistics_account_group');
    await queryRunner.dropIndex('verify_statistics', 'idx_verify_statistics_group');
  }
}
