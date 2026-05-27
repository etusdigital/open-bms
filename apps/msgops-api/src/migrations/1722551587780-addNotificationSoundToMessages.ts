import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class addNotificationSoundToMessages1722551587780 implements MigrationInterface {
  private columns = [
    new TableColumn({
      name: 'notification_sound',
      type: 'varchar',
      length: '60',
      isNullable: true,
    }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('messages', this.columns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('messages', this.columns);
  }
}
