import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class createTableLabels1759843863474 implements MigrationInterface {
  name = 'createTableLabels1759843863474';

  private table = new Table({
    name: 'labels',
    columns: [
      { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'account_id', type: 'int', isNullable: false },
      { name: 'name', type: 'varchar', length: '100', isNullable: false },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'created_at', type: 'timestamp', isNullable: false, default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'timestamp', isNullable: true, onUpdate: 'CURRENT_TIMESTAMP' },
      { name: 'deleted_at', type: 'timestamp', isNullable: true },
    ],
  });

  private uniqueConstraintLabelsAccountIdName = new TableUnique({
    name: 'unique_labels_account_id_name',
    columnNames: ['account_id', 'name'],
  });

  private foreignKeyLabelsAccountId = new TableForeignKey({
    name: 'fk_labels_account_id',
    columnNames: ['account_id'],
    referencedTableName: 'accounts',
    referencedColumnNames: ['id'],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createUniqueConstraint(this.table, this.uniqueConstraintLabelsAccountIdName);
    await queryRunner.createForeignKey(this.table, this.foreignKeyLabelsAccountId);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
    await queryRunner.dropUniqueConstraint(this.table, this.uniqueConstraintLabelsAccountIdName);
    await queryRunner.dropForeignKey(this.table, this.foreignKeyLabelsAccountId);
  }
}
