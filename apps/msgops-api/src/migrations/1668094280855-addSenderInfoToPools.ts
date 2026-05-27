import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addSenderInfoToPools1668094280855 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'sender_email',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'sender_name',
      type: 'varchar',
      length: '60',
      isNullable: true,
    }),
    new TableColumn({
      name: 'sender_replyto_email',
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: 'is_default',
      type: 'boolean',
      default: false,
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('pools', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('pools', this.columns);
  }
}
