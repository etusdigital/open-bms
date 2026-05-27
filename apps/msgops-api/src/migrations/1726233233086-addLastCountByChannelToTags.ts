import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addLastCountByChannelToTags1726233233086 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'last_count_email',
      type: 'int',
      default: 0,
      isNullable: true,
    }),
    new TableColumn({
      name: 'last_count_web_push',
      type: 'int',
      default: 0,
      isNullable: true,
    }),
    new TableColumn({
      name: 'last_count_mobile_push',
      type: 'int',
      default: 0,
      isNullable: true,
    }),
    new TableColumn({
      name: 'last_count_phone',
      type: 'int',
      default: 0,
      isNullable: true,
    }),
    new TableColumn({
      name: 'last_count_whatsapp',
      type: 'int',
      default: 0,
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('tags', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('tags', this.columns);
  }
}
