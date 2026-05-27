import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addProviderIdUser1657816390119 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'provider_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.query('ALTER TABLE public.users ALTER COLUMN profile TYPE varchar(500)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE public.users ALTER COLUMN profile TYPE varchar(500) UNIQUE');
  }
}
