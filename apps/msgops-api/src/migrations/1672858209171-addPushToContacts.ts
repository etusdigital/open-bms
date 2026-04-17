import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addPushToContacts1672858209171 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'has_email',
      type: 'boolean',
      default: true,
      isNullable: false,
    }),
    new TableColumn({
      name: 'has_phone',
      type: 'boolean',
      default: false,
      isNullable: false,
    }),
    new TableColumn({
      name: 'has_web_push',
      type: 'boolean',
      default: false,
      isNullable: false,
    }),
    new TableColumn({
      name: 'has_mobile_push',
      type: 'boolean',
      default: false,
      isNullable: false,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('contacts', this.columns);
    await queryRunner.query('ALTER TABLE contacts ALTER COLUMN email DROP NOT NULL');
    await queryRunner.query('ALTER TABLE contacts ALTER COLUMN hashed_email DROP NOT NULL');
    await queryRunner.query('ALTER TABLE contacts ALTER COLUMN email_provider DROP NOT NULL');
    await queryRunner.query('ALTER TABLE contacts ALTER COLUMN first_name DROP NOT NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('contacts', this.columns);
    await queryRunner.query('ALTER TABLE contacts ALTER COLUMN email SET NOT NULL');
    await queryRunner.query('ALTER TABLE contacts ALTER COLUMN hashed_email SET NOT NULL');
    await queryRunner.query('ALTER TABLE contacts ALTER COLUMN email_provider SET NOT NULL');
    await queryRunner.query('ALTER TABLE contacts ALTER COLUMN first_name SET NOT NULL');
  }
}
