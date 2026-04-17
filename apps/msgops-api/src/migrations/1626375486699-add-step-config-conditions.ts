import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class addStepConfigConditions1626375486699 implements MigrationInterface {
  name = 'addStepConfigConditions1626375486699';
  private table = new Table({
    name: 'step_config_conditions',
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
        name: 'group_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'condition_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'type',
        type: 'varchar',
        length: '20',
        isNullable: false,
      },
      {
        name: 'option',
        type: 'varchar',
        length: '30',
        isNullable: false,
      },
      {
        name: 'value',
        type: 'integer',
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
      'step_config_conditions',
      new TableForeignKey({
        columnNames: ['step_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'automation_steps',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'step_config_conditions',
      new TableForeignKey({
        columnNames: ['group_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'step_config_groups',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
