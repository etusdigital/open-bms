import { Entity, PrimaryGeneratedColumn, Column, Unique, UpdateDateColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { CampaignsRulesConfigsEntity } from './campaigns-rules-configs.entity';

@Entity('campaigns_rules')
@Unique(['accountId', 'name'])
export class CampaignsRulesEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'account_id' })
  accountId: number;

  @Column({ type: 'varchar', name: 'name' })
  name: string;

  @Column({ type: 'varchar', name: 'description' })
  description: string;

  @Column({ type: 'jsonb', name: 'week_days' })
  weekDays: number[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => CampaignsRulesConfigsEntity, (campaignsRulesConfigs) => campaignsRulesConfigs.campaignRule, {
    eager: true,
    nullable: true,
  })
  campaignsRulesConfigs: Array<CampaignsRulesConfigsEntity>;
}
