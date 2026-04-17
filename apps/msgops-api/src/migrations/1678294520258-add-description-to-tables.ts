import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addDescriptionToTables1678294520258 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'description',
      type: 'text',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('automations', this.columns);
    await queryRunner.addColumns('campaigns', this.columns);
    await queryRunner.addColumns('emails_templates', this.columns);
    await queryRunner.addColumns('pools', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('automations', this.columns);
    await queryRunner.dropColumns('campaigns', this.columns);
    await queryRunner.dropColumns('emails_templates', this.columns);
    await queryRunner.dropColumns('pools', this.columns);
  }
}
