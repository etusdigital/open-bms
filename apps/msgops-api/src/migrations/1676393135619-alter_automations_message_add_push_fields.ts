import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class alterAutomationsMessageAddPushFields1676393135619 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'image',
      type: 'varchar',
      length: '500',
      isNullable: true,
    }),
    new TableColumn({
      name: 'url',
      type: 'varchar',
      length: '500',
      isNullable: true,
    }),
    new TableColumn({
      name: 'description',
      type: 'text',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('automations_message', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('automations_message', this.columns);
  }
}
