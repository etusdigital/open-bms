import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class addStepTypeTable1625058533651 implements MigrationInterface {
  name = 'addStepTypeTable1625058533651';
  private table = new Table({
    name: 'step_types',
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
        length: '100',
        isUnique: true,
        isNullable: false,
      },
      {
        name: 'reference_column',
        type: 'varchar',
        length: '100',
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
    await queryRunner.query("INSERT INTO step_types (name, reference_column) VALUES ('email', 'message_id')");
    await queryRunner.query("INSERT INTO step_types (name, reference_column) VALUES ('timer', 'value')");
    await queryRunner.query("INSERT INTO step_types (name, reference_column) VALUES ('add_into_list', 'value')");
    await queryRunner.query("INSERT INTO step_types (name, reference_column) VALUES ('remove_from_list', 'value')");
    await queryRunner.query("INSERT INTO step_types (name, reference_column) VALUES ('end', 'value')");
    await queryRunner.query("INSERT INTO step_types (name, reference_column) VALUES ('add_tag', 'value')");
    await queryRunner.query("INSERT INTO step_types (name, reference_column) VALUES ('condition', null)");
    await queryRunner.query("INSERT INTO step_types (name, reference_column) VALUES ('add_trigger', 'value')");
    await queryRunner.query("INSERT INTO step_types (name, reference_column) VALUES ('remove_tag', 'value')");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
