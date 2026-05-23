import {
  AfterLoad,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AutomationEntity } from './automation.entity';
import { CustomFieldsEntity } from './custom-fields.entity';
import { AccountConfigEntity } from './account-config.entity';
import { CampaignEntity } from './campaign.entity';

@Entity('accounts')
export class AccountEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;
  @Column('text', { name: 'description' })
  description: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToMany(() => AutomationEntity, (automation) => automation.account, {
    eager: false,
    nullable: true,
  })
  automations?: AutomationEntity[];

  @OneToMany(() => CampaignEntity, (campaign) => campaign.account, {
    eager: false,
    nullable: true,
  })
  campaigns?: CampaignEntity[];

  @OneToMany(() => CustomFieldsEntity, (customFields) => customFields.account, {
    eager: true,
    nullable: true,
  })
  customFields?: CustomFieldsEntity[] | Array<string>;

  @OneToMany(() => AccountConfigEntity, (accountConfigs) => accountConfigs.account, {
    eager: true,
    nullable: true,
  })
  accountConfigs?: AccountConfigEntity[] | Record<string, string>;

  @AfterLoad()
  parseAccount() {
    this.accountConfigs = (this.accountConfigs as AccountConfigEntity[]).reduce((obj, item) => {
      obj[item.name] = item.value;
      return obj;
    }, {});
    this.customFields = this.customFields.map((customField) => customField.name);
  }
}
