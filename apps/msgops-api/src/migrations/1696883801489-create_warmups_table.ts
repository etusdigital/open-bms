import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class createWarmupsTable1687869356167 implements MigrationInterface {
  private table = new Table({
    name: 'warmups',
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
        name: 'sender',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'ippool',
        type: 'varchar',
        length: '255',
        isNullable: false,
      },
      {
        name: 'target',
        type: 'int',
        isNullable: false,
      },
      {
        name: 'current_send',
        type: 'int',
        isNullable: false,
      },
      {
        name: 'target_account_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'campaign_id',
        type: 'integer',
        isNullable: false,
      },
      {
        name: 'last_sent_at',
        type: 'timestamp with time zone',
        isNullable: true,
      },
      {
        name: 'status',
        type: 'varchar',
        length: '20',
        isNullable: false,
      },
      {
        name: 'warmup_info',
        type: 'jsonb',
        isNullable: true,
      },
      {
        name: 'created_at',
        type: 'timestamp with time zone',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'updated_at',
        type: 'timestamp with time zone',
        isNullable: true,
        onUpdate: 'CURRENT_TIMESTAMP',
      },
      {
        name: 'deleted_at',
        type: 'timestamp with time zone',
        isNullable: true,
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(
      'warmups',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'warmups',
      new TableForeignKey({
        columnNames: ['target_account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'warmups',
      new TableForeignKey({
        columnNames: ['campaign_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'campaigns',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
