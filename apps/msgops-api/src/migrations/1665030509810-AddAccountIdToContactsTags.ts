import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddAccountIdToContactsTags1665030509810 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'account_id',
      type: 'int',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts_tags', this.columns);
    await queryRunner.createForeignKey(
      'contacts_tags',
      new TableForeignKey({
        columnNames: ['account_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'accounts',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('contacts_tags', this.columns);
  }
}
