import { MigrationInterface, QueryRunner } from 'typeorm';

export class renameAutomationsMessageTable1716221847462 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE automations_message RENAME TO messages`);
    await queryRunner.query(`UPDATE messages SET type = 'email' WHERE type IN ('campaign', 'automation')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE messages RENAME TO automations_message`);
    await queryRunner.query(`UPDATE automations_message SET type = 'automation' WHERE type = 'email';`);
  }
}
