import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class addStepConfigGroups1626375295371 implements MigrationInterface {
  name = 'addStepConfigGroups1626375295371';
  private table = new Table({
    name: 'step_config_groups',
    columns: [
      {
        name: 'id',
        type: 'integer',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'step_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'logic',
        type: 'varchar',
        length: '20',
        isNullable: false,
      },
      {
        name: 'created_at',
        type: 'TIMESTAMP',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'updated_at',
        type: 'TIMESTAMP',
        isNullable: true,
        onUpdate: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'deleted_at',
        type: 'TIMESTAMP',
        isNullable: true,
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'step_config_groups',
      new TableForeignKey({
        columnNames: ['step_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'automation_steps',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
