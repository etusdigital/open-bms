import { AfterLoad, BeforeUpdate, Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AutomationEntity } from './automation.entity';
import { MessageEntity } from './message.entity';
import { EmailsTemplatesEntity } from './emails-templates.entity';
import { UserAccountEntity } from './users-account.entity';
import { AccountConfigEntity } from './account-config.entity';
import { CustomFieldsEntity } from './custom-fields.entity';
import { createHash } from 'crypto';
import { CampaignEntity } from './campaign.entity';
import { Transform } from 'class-transformer';

@Entity('accounts')
export class AccountEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('text', { name: 'description' })
  description?: string;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;
  @Column('integer', { name: 'group_id' })
  groupId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToMany(() => AutomationEntity, (automation) => automation.account)
  automations?: AutomationEntity[];

  @OneToMany(() => MessageEntity, (automationMessage) => automationMessage.account)
  automationMessages?: MessageEntity[];

  @OneToMany(() => EmailsTemplatesEntity, (emailTemplate) => emailTemplate.account)
  emailTemplates?: EmailsTemplatesEntity[];

  @OneToMany(() => UserAccountEntity, (userAccount) => userAccount.account, {
    eager: false,
    nullable: true,
  })
  userAccount: Array<UserAccountEntity>;

  @OneToMany(() => CustomFieldsEntity, (customFields) => customFields.account, {
    eager: true,
    nullable: true,
  })
  customFields?: CustomFieldsEntity[];

  @OneToMany(() => AccountConfigEntity, (accountConfigs) => accountConfigs.account, {
    eager: true,
    nullable: true,
  })
  @Transform(({ value }) => AccountEntity.sanitizeAccountConfigs(value), { toPlainOnly: true })
  accountConfigs?: AccountConfigEntity[];

  @OneToMany(() => CampaignEntity, (campaign) => campaign.account, {
    eager: false,
    nullable: true,
  })
  campaigns?: CampaignEntity[];

  @BeforeUpdate()
  callbeforeupdate() {
    this.updatedAt = new Date();
  }

  configByName(name: string): AccountConfigEntity {
    return this.accountConfigs.find((config: AccountConfigEntity) => config.name === name);
  }

  accountHash?: string;

  static readonly HIDDEN_CONFIGS = [
    'account_costs',
    'sendgrid_key',
    'sparkpost_key',
    'firebase_service_account_app',
    'twilio_sid',
    'twilio_sid_account',
    'twilio_auth_account',
    'twilio_secret',
    'twilio_sms_service',
    'twilio_whatsapp_service',
    'bfp_account_id',
    'default_country',
    'default_sender_name',
    'default_sender_email',
    '2fa_settings',
    'google_manager_config',
    'whatsapp_access_token',
    'whatsapp_business_id',
  ];

  static readonly MASKED_CONFIGS = ['api_key', 'api_key_tracker', 'whatsapp_access_token'];

  static sanitizeAccountConfigs(configs: AccountConfigEntity[]): AccountConfigEntity[] {
    if (!configs) {
      return configs;
    }
    return configs
      .filter((c) => !AccountEntity.HIDDEN_CONFIGS.includes(c.name))
      .map((c) => {
        if (AccountEntity.MASKED_CONFIGS.includes(c.name) && c.value && c.value.length > 5) {
          return { ...c, value: c.value.substring(0, 5) + '••••••••••••' } as AccountConfigEntity;
        }
        return c;
      });
  }

  @AfterLoad()
  computeAccountHash() {
    this.accountHash = createHash('sha256').update(`${this.id}`).digest('hex');
  }
}
