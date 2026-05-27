import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterTagsAddStatus1693414771160 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'status',
      type: 'varchar',
      length: '20',
      default: `'active'`,
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('tags', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('tags', this.columns);
  }
}
