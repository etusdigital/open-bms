import { Entity, PrimaryGeneratedColumn, Column, Unique, UpdateDateColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { CampaignsRulesConfigsEntity } from './campaigns-rules-configs.entity';

@Entity('campaigns_configs')
@Unique(['accountId', 'name'])
export class CampaignsConfigsEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'account_id' })
  accountId: number;

  @Column({ type: 'varchar', name: 'name' })
  name: string;

  @Column({ type: 'varchar', name: 'description' })
  description: string;

  @Column({ type: 'jsonb', name: 'configs' })
  configs: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => CampaignsRulesConfigsEntity, (campaignsRulesConfigs) => campaignsRulesConfigs.campaignConfig, {
    nullable: true,
  })
  campaignsRulesConfigs: Array<CampaignsRulesConfigsEntity>;
}
