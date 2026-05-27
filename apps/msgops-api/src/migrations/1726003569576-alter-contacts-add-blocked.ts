import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterContactsAddBlocked1726003569576 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'unsubscribed_at',
      type: 'timestamptz',
      isNullable: true,
    }),
    new TableColumn({
      name: 'is_blocked',
      type: 'boolean',
      default: false,
      isNullable: false,
    }),
    new TableColumn({
      name: 'blocked_at',
      type: 'timestamptz',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('contacts', this.columns);
  }
}
