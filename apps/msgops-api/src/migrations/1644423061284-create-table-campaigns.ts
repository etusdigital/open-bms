import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class createTableCampaigns1644423061284 implements MigrationInterface {
  private table = new Table({
    name: 'campaigns',
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
        name: 'name',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'publisher',
        type: 'varchar',
        length: '100',
        isNullable: false,
      },
      {
        name: 'schedule_to',
        type: 'varchar',
        length: '100',
        isNullable: false,
      },
      {
        name: 'schedule_to_cloud_task_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      },
      {
        name: 'tags',
        type: 'json',
        isNullable: true,
      },
      {
        name: 'status',
        type: 'integer',
        isNullable: true,
      },
      {
        name: 'spread_sending',
        type: 'integer',
        default: 0,
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
      'campaigns',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createUniqueConstraint(
      'campaigns',
      new TableUnique({
        name: 'campaigns_name_unique',
        columnNames: ['name', 'account_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
