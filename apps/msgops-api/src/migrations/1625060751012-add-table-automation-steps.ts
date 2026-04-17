import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class addTableAutomationSteps1625060751012 implements MigrationInterface {
  name = 'addTableAutomationSteps1625060751012';
  private table = new Table({
    name: 'automation_steps',
    columns: [
      {
        name: 'id',
        type: 'integer',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'automation_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'step_type_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'message_id',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'position',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'name',
        type: 'varchar',
        length: '200',
        isNullable: true,
      },
      {
        name: 'value',
        type: 'varchar',
        length: '200',
        isNullable: true,
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
      'automation_steps',
      new TableForeignKey({
        columnNames: ['automation_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'automations',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'automation_steps',
      new TableForeignKey({
        columnNames: ['step_type_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'step_types',
      }),
    );
    await queryRunner.createForeignKey(
      'automation_steps',
      new TableForeignKey({
        columnNames: ['message_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'automations_message',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
