import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addIsValidToContacts1671571559740 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'is_valid',
      type: 'boolean',
      default: true,
      isNullable: false,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('contacts', this.columns);
  }
}
