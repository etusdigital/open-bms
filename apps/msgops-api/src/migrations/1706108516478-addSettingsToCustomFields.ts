import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addSettingsToCustomFields1706108516478 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'type',
      type: 'varchar',
      length: '50',
      isNullable: true,
    }),
    new TableColumn({
      name: 'attribution_type',
      type: 'varchar',
      length: '20',
      isNullable: true,
    }),
    new TableColumn({
      name: 'label',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'placeholder',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'field_format',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'file_formats',
      type: 'text []',
      isNullable: true,
    }),
    new TableColumn({
      name: 'character_limit',
      type: 'int',
      isNullable: true,
    }),
    new TableColumn({
      name: 'decimal_length',
      type: 'int',
      isNullable: true,
    }),
    new TableColumn({
      name: 'options',
      type: 'text []',
      isNullable: true,
    }),
    new TableColumn({
      name: 'mask',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('custom_fields', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('custom_fields', this.columns);
  }
}
