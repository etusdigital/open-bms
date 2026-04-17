import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addLastCountToTags1683827691646 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'last_count',
      type: 'int',
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
