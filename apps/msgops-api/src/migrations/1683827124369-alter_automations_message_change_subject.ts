import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAutomationsMessageChangeSubject1683827124369 implements MigrationInterface {
  private columns = [
    {
      oldColumn: new TableColumn({
        name: 'subject',
        type: 'varchar',
        length: '255',
        isNullable: false,
      }),
      newColumn: new TableColumn({
        name: 'subject',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumns('automations_message', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumns('automations_message', this.columns);
  }
}
