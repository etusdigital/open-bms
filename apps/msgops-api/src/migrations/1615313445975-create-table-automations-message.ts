import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class createTableAutomationsMessage1615313445975 implements MigrationInterface {
  private table = new Table({
    name: 'automations_message',
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
        name: 'title',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'subject',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'preview_text',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'content',
        type: 'text',
        isNullable: false,
      },
      {
        name: 'content_json',
        type: 'json',
        isNullable: true,
      },
      {
        name: 'text',
        type: 'text',
        isNullable: false,
      },
      {
        name: 'from_mail',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'from_name',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'is_tested',
        type: 'boolean',
        isNullable: false,
        default: false,
      },
      {
        name: 'message_id',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'ippool',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'reply_to',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'priority',
        type: 'varchar',
        length: '20',
        isNullable: false,
        default: `'normal'`,
      },
      {
        name: 'bucket_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'file_name',
        type: 'text',
        isNullable: true,
      },
      {
        name: 'template_url',
        type: 'varchar',
        length: '350',
        isNullable: true,
      },
      {
        name: 'version',
        type: 'integer',
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
      'automations_message',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createUniqueConstraint(
      'automations_message',
      new TableUnique({
        name: 'automations_message_title_unique',
        columnNames: ['title', 'account_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
