import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds `template_category` to `messages` so the WhatsApp template submitter
 * stops hardcoding MARKETING. Existing rows stay null and the backend
 * normalises null → MARKETING when calling Meta.
 */
export class AddTemplateCategoryToMessages1781100000000 implements MigrationInterface {
  private readonly column = new TableColumn({
    name: 'template_category',
    type: 'varchar',
    length: '32',
    isNullable: true,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('messages');
    if (table && !table.findColumnByName('template_category')) {
      await queryRunner.addColumn('messages', this.column);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('messages');
    if (table && table.findColumnByName('template_category')) {
      await queryRunner.dropColumn('messages', 'template_category');
    }
  }
}
