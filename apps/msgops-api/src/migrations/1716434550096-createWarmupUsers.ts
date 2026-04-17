import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateWarmupUsers1716434550096 implements MigrationInterface {
  private table = new Table({
    name: 'warmup_users',
    columns: [
      {
        name: 'id',
        type: 'integer',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'name',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'email',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'is_internal',
        type: 'boolean',
        default: false,
        isNullable: false,
      },
      {
        name: 'slack_id',
        type: 'varchar',
        length: '60',
        isNullable: true,
      },
      {
        name: 'created_at',
        type: 'timestamptz',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'updated_at',
        type: 'timestamptz',
        isNullable: true,
        onUpdate: 'CURRENT_TIMESTAMP',
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
