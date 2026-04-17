import { MigrationInterface, QueryRunner, TableColumn, TableUnique } from 'typeorm';

export class alterTableIpReputationDailyAddColumns1771113600000 implements MigrationInterface {
  name = 'alterTableIpReputationDailyAddColumns1771113600000';

  private tableName = 'ip_reputation_daily';

  private oldUniqueConstraint = new TableUnique({
    name: 'uq_ip_reputation_daily',
    columnNames: ['date', 'account_id', 'pool', 'ip'],
  });

  private newUniqueConstraint = new TableUnique({
    name: 'uq_ip_reputation_daily',
    columnNames: ['date', 'account_id', 'provider_account', 'pool', 'ip'],
  });

  private newColumns = [
    new TableColumn({ name: 'provider_account', type: 'varchar', length: '255', isNullable: true }),
    new TableColumn({ name: 'deferred', type: 'int', isNullable: true, default: 0 }),
    new TableColumn({ name: 'bounce', type: 'int', isNullable: true, default: 0 }),
    new TableColumn({ name: 'spam_report', type: 'int', isNullable: true, default: 0 }),
    new TableColumn({ name: 'unsubscribe', type: 'int', isNullable: true, default: 0 }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns(this.tableName, this.newColumns);
    await queryRunner.dropUniqueConstraint(this.tableName, this.oldUniqueConstraint);
    await queryRunner.createUniqueConstraint(this.tableName, this.newUniqueConstraint);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint(this.tableName, this.newUniqueConstraint);
    await queryRunner.createUniqueConstraint(this.tableName, this.oldUniqueConstraint);
    await queryRunner.dropColumns(this.tableName, this.newColumns);
  }
}
