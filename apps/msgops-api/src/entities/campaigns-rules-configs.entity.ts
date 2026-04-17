import { Entity, PrimaryGeneratedColumn, Column, Unique, JoinColumn, ManyToOne } from 'typeorm';
import { CampaignsRulesEntity } from './campaigns-rules.entity';
import { CampaignsConfigsEntity } from './campaigns-configs.entity';

@Entity('campaigns_rules_configs')
@Unique(['campaignRuleId', 'campaignConfigId'])
export class CampaignsRulesConfigsEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'campaign_rule_id' })
  campaignRuleId: number;

  @Column({ type: 'int', name: 'campaign_config_id' })
  campaignConfigId: number;

  @ManyToOne(() => CampaignsRulesEntity, (campaignRule) => campaignRule.campaignsRulesConfigs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'campaign_rule_id' }])
  campaignRule: CampaignsRulesEntity;

  @ManyToOne(() => CampaignsConfigsEntity, (campaignConfig) => campaignConfig.campaignsRulesConfigs, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'campaign_config_id' }])
  campaignConfig: CampaignsConfigsEntity;
}
