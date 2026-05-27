import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class createTableAutomationsTargets1754681807461 implements MigrationInterface {
  name = 'createTableAutomationsTargets1754681807461';

  private tableAutomationsTargets = new Table({
    name: 'automations_targets',
    columns: [
      { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'date', type: 'date', isNullable: false },
      { name: 'account_id', type: 'integer', isNullable: false },
      { name: 'automation_id', type: 'integer', isNullable: false },
      { name: 'count', type: 'integer', isNullable: false, default: 0 },
    ],
  });

  //Foreign Keys
  private foreignKeyAutomationsTargetsAccountId = new TableForeignKey({
    name: 'fk_automations_targets_account_id',
    columnNames: ['account_id'],
    referencedTableName: 'accounts',
    referencedColumnNames: ['id'],
  });

  private foreignKeyAutomationsTargetsAutomationId = new TableForeignKey({
    name: 'fk_automations_targets_automation_id',
    columnNames: ['automation_id'],
    referencedTableName: 'automations',
    referencedColumnNames: ['id'],
  });

  //Unique Constraints
  private uniqueConstraintAutomationsTargetsDateAccountIdAutomationId = new TableUnique({
    name: 'uk_automations_targets_date_account_id_automation_id',
    columnNames: ['date', 'account_id', 'automation_id'],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.tableAutomationsTargets);
    await queryRunner.createForeignKey(this.tableAutomationsTargets, this.foreignKeyAutomationsTargetsAccountId);
    await queryRunner.createForeignKey(this.tableAutomationsTargets, this.foreignKeyAutomationsTargetsAutomationId);
    await queryRunner.createUniqueConstraint(this.tableAutomationsTargets, this.uniqueConstraintAutomationsTargetsDateAccountIdAutomationId);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.tableAutomationsTargets);
    await queryRunner.dropForeignKey(this.tableAutomationsTargets, this.foreignKeyAutomationsTargetsAccountId);
    await queryRunner.dropForeignKey(this.tableAutomationsTargets, this.foreignKeyAutomationsTargetsAutomationId);
    await queryRunner.dropUniqueConstraint(this.tableAutomationsTargets, this.uniqueConstraintAutomationsTargetsDateAccountIdAutomationId);
  }
}
