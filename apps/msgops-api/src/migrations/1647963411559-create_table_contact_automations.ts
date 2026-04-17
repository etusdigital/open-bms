import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class createTableContactAutomations1647963411559 implements MigrationInterface {
  private table = new Table({
    name: 'contacts_automations',
    columns: [
      {
        name: 'id',
        type: 'integer',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'account_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'contact_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'status',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'automation_id',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'automation_title',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'automation_type',
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
        name: 'created_at_date',
        type: 'DATE',
        isNullable: false,
        default: 'CURRENT_DATE',
      },
      {
        name: 'updated_at',
        type: 'TIMESTAMP',
        isNullable: true,
        onUpdate: 'CURRENT_TIMESTAMP',
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'contacts_automations',
      new TableForeignKey({
        columnNames: ['contact_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'contacts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'contacts_automations',
      new TableForeignKey({
        columnNames: ['automation_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'automations',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'contacts_automations',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'contacts_automations',
      new TableIndex({
        name: 'index_contacts_automations_created_at_date',
        columnNames: ['created_at_date'],
      }),
    );
    await queryRunner.createIndex(
      'contacts_automations',
      new TableIndex({
        name: 'index_contacts_automations_status',
        columnNames: ['status'],
      }),
    );
    await queryRunner.createIndex(
      'contacts_automations',
      new TableIndex({
        name: 'index_contacts_automations_contact_id_account_id',
        columnNames: ['contact_id', 'account_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
