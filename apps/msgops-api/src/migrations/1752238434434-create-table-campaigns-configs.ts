import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique } from 'typeorm';

export class createTableCampaignsConfigs1752238434434 implements MigrationInterface {
  name = 'createTableCampaignsConfigs1752238434434';

  //Tables
  tableCampaignsConfigs = new Table({
    name: 'campaigns_configs',
    columns: [
      { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'account_id', type: 'int' },
      { name: 'name', type: 'varchar' },
      { name: 'description', type: 'varchar' },
      { name: 'configs', type: 'jsonb' },
      { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
    ],
  });

  tableCampaignsRules = new Table({
    name: 'campaigns_rules',
    columns: [
      { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'name', type: 'varchar' },
      { name: 'description', type: 'varchar' },
      { name: 'account_id', type: 'int' },
      { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
    ],
  });

  tableCampaigsRulesConfigs = new Table({
    name: 'campaigns_rules_configs',
    columns: [
      { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'campaign_rule_id', type: 'int' },
      { name: 'campaign_config_id', type: 'int' },
    ],
  });

  //Foreign Keys

  foreignKeyCampaignsConfigsAccountId = new TableForeignKey({
    name: 'fk_campaigns_configs_account_id',
    columnNames: ['account_id'],
    referencedColumnNames: ['id'],
    referencedTableName: 'accounts',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  foreignKeyCampaignsRulesAccountId = new TableForeignKey({
    name: 'fk_campaigns_rules_account_id',
    columnNames: ['account_id'],
    referencedColumnNames: ['id'],
    referencedTableName: 'accounts',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  foreignKeyCampaignsRulesConfigsCampaignRuleId = new TableForeignKey({
    name: 'fk_campaigns_rules_configs_campaign_rule_id',
    columnNames: ['campaign_rule_id'],
    referencedColumnNames: ['id'],
    referencedTableName: 'campaigns_rules',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  foreignKeyCampaignsRulesConfigsCampaignConfigId = new TableForeignKey({
    name: 'fk_campaigns_rules_configs_campaign_config_id',
    columnNames: ['campaign_config_id'],
    referencedColumnNames: ['id'],
    referencedTableName: 'campaigns_configs',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  //Unique Constraints
  uniqueConstraintCampaignsConfigsNameAccountId = new TableUnique({
    name: 'unique_name_account_id_campaigns_configs',
    columnNames: ['name', 'account_id'],
  });

  uniqueConstraintCampaignsRulesNameAccountId = new TableUnique({
    name: 'unique_name_account_id_campaigns_rules',
    columnNames: ['name', 'account_id'],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    //Create Tables
    await queryRunner.createTable(this.tableCampaignsConfigs);
    await queryRunner.createTable(this.tableCampaignsRules);
    await queryRunner.createTable(this.tableCampaigsRulesConfigs);

    //Create Foreign Keys
    await queryRunner.createForeignKey('campaigns_configs', this.foreignKeyCampaignsConfigsAccountId);
    await queryRunner.createForeignKey('campaigns_rules', this.foreignKeyCampaignsRulesAccountId);
    await queryRunner.createForeignKey('campaigns_rules_configs', this.foreignKeyCampaignsRulesConfigsCampaignRuleId);
    await queryRunner.createForeignKey('campaigns_rules_configs', this.foreignKeyCampaignsRulesConfigsCampaignConfigId);

    //Create Unique Constraints
    await queryRunner.createUniqueConstraint('campaigns_configs', this.uniqueConstraintCampaignsConfigsNameAccountId);
    await queryRunner.createUniqueConstraint('campaigns_rules', this.uniqueConstraintCampaignsRulesNameAccountId);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    //Drop Foreign Keys
    await queryRunner.dropForeignKey('campaigns_configs', this.foreignKeyCampaignsConfigsAccountId);
    await queryRunner.dropForeignKey('campaigns_rules', this.foreignKeyCampaignsRulesAccountId);
    await queryRunner.dropForeignKey('campaigns_rules_configs', this.foreignKeyCampaignsRulesConfigsCampaignRuleId);
    await queryRunner.dropForeignKey('campaigns_rules_configs', this.foreignKeyCampaignsRulesConfigsCampaignConfigId);

    //Drop Unique Constraints
    await queryRunner.dropUniqueConstraint('campaigns_configs', this.uniqueConstraintCampaignsConfigsNameAccountId);
    await queryRunner.dropUniqueConstraint('campaigns_rules', this.uniqueConstraintCampaignsRulesNameAccountId);

    //Drop Tables
    await queryRunner.dropTable('campaigns_configs');
    await queryRunner.dropTable('campaigns_rules');
    await queryRunner.dropTable('campaigns_rules_configs');
  }
}
