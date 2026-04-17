import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

export class createTableIpReputationDaily1771027200000 implements MigrationInterface {
  name = 'createTableIpReputationDaily1771027200000';

  private table = new Table({
    name: 'ip_reputation_daily',
    columns: [
      { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'date', type: 'date', isNullable: false },
      { name: 'account_id', type: 'int', isNullable: false },
      { name: 'pool', type: 'varchar', length: '255', isNullable: true },
      { name: 'ip', type: 'varchar', length: '50', isNullable: true },
      { name: 'delivered', type: 'int', isNullable: true, default: 0 },
      { name: 'open', type: 'int', isNullable: true, default: 0 },
      { name: 'click', type: 'int', isNullable: true, default: 0 },
      { name: 'created_at', type: 'TIMESTAMP', isNullable: false, default: 'CURRENT_TIMESTAMP' },
    ],
  });

  private uniqueConstraint = new TableUnique({
    name: 'uq_ip_reputation_daily',
    columnNames: ['date', 'account_id', 'pool', 'ip'],
  });

  private indexDateAccountId = new TableIndex({
    name: 'idx_ip_reputation_daily_date_account_id',
    columnNames: ['date', 'account_id'],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createUniqueConstraint(this.table, this.uniqueConstraint);
    await queryRunner.createIndex(this.table, this.indexDateAccountId);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(this.table, this.indexDateAccountId);
    await queryRunner.dropUniqueConstraint(this.table, this.uniqueConstraint);
    await queryRunner.dropTable(this.table);
  }
}
