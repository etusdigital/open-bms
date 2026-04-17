import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CampaignEntity } from './campaign.entity';
import { AccountConfigEntity } from './account-config.entity';
import { CustomFieldsEntity } from './custom-fields.entity';

@Entity('accounts')
export class AccountEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('text', { name: 'description' })
  description: string;

  @Column('boolean', { name: 'is_internal', default: false })
  isInternal: boolean;

  @Column('integer', { name: 'group_id' })
  groupId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToMany(() => CampaignEntity, (campaign) => campaign.account)
  campaigns?: CampaignEntity[];

  @OneToMany(() => CustomFieldsEntity, (customFields) => customFields.account, {
    eager: false,
    nullable: true,
  })
  customFields?: CustomFieldsEntity[];

  @OneToMany(() => AccountConfigEntity, (accountConfigs) => accountConfigs.account, {
    eager: false,
    nullable: true,
  })
  accountConfigs?: AccountConfigEntity[];

  configByName(name: string): string {
    const config = this.accountConfigs.find((config: AccountConfigEntity) => config.name === name);
    return config?.value || null;
  }
}
