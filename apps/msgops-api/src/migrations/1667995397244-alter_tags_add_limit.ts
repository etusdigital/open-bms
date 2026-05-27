import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterTagsAddLimit1667995397244 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'contacts_limit',
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
