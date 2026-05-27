import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterMessageAddTypeIsRateLimit1737129339780 implements MigrationInterface {
  private columnMessage = new TableColumn({
    name: 'message_category',
    type: 'varchar',
    length: '255',
    isNullable: true,
  });

  private columnLimit = new TableColumn({
    name: 'is_rate_limit',
    type: 'boolean',
    default: false,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('messages', this.columnMessage);
    await queryRunner.addColumn('automations', this.columnLimit);
    await queryRunner.addColumn('campaigns', this.columnLimit);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('messages', this.columnMessage);
    await queryRunner.dropColumn('automations', this.columnLimit);
    await queryRunner.dropColumn('campaigns', this.columnLimit);
  }
}
