import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterTableUsersAddLanguage1663097756488 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'language',
      type: 'varchar',
      length: '20',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('users', this.columns);
  }
}
