import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

export class updateAutomationMessageUniqueConstraint1696883801488 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint(
      'automations_message',
      new TableUnique({
        name: 'automations_message_title_unique',
        columnNames: ['title', 'account_id'],
      }),
    );

    await queryRunner.createUniqueConstraint(
      'automations_message',
      new TableUnique({
        name: 'automations_message_title_unique',
        columnNames: ['title', 'account_id', 'type'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint(
      'automations_message',
      new TableUnique({
        name: 'automations_message_title_unique',
        columnNames: ['title', 'account_id', 'type'],
      }),
    );

    await queryRunner.createUniqueConstraint(
      'automations_message',
      new TableUnique({
        name: 'automations_message_title_unique',
        columnNames: ['title', 'account_id'],
      }),
    );
  }
}
