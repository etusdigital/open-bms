import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterTagsAddTagType1676393190864 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'tag_type',
      type: 'varchar',
      length: '30',
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
