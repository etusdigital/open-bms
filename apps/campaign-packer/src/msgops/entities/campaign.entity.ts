import { AfterLoad, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AccountEntity } from './account.entity';
import { CampaignContactEntity } from './campaign-contact.entity';
import { CampaignMessageEntity } from './campaign-message.entity';
import { CampaignRecurrenceSettings, CampaignType } from 'src/interfaces';
import { WarmupEntity } from './warmup.entity';
@Entity('campaigns')
export class CampaignEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'title', length: 255 })
  title: string;

  @Column('varchar', { name: 'name', length: 40 })
  name: string;

  @Column('varchar', { name: 'publisher', length: 100 })
  publisher: string;

  @Column('timestamptz', { name: 'schedule_to' })
  scheduleTo: Date;

  @Column('varchar', { name: 'schedule_to_cloud_task_id', length: 255 })
  scheduleToCloudTaskId: string;

  @Column('int', { name: 'status' })
  status: number;

  @Column('int', { name: 'spread_sending' })
  spreadSending: number;

  @Column('int', { name: 'sent_contacts' })
  sentContacts: number;

  @Column('decimal', { name: 'sent_percentage' })
  sentPercentage: number;

  @Column('text', { name: 'query' })
  query: string;

  @Column('json', { name: 'steps' })
  steps: string;

  @Column('json', { name: 'tags' })
  tags: string;

  @Column('varchar', { name: 'type', length: 30 })
  type: string;

  @Column('varchar', { name: 'message_type', length: 30 })
  messageType: string;

  @Column('bool', { name: 'is_rate_limit' })
  isRateLimit: boolean;

  @Column('boolean', { name: 'send_to_all', default: false })
  sendToAll: boolean;

  @Column('bool', { name: 'is_run_segment' })
  runSegment: boolean;

  @Column('timestamptz', { name: 'testab_schedule_to' })
  testabScheduleTo: Date;

  @Column('timestamptz', { name: 'testab_schedule_end' })
  testabScheduleEnd: Date;

  @Column('int', { name: 'testab_audience_percent' })
  testabAudiencePercent: number;

  @Column('varchar', { name: 'testab_criteria', length: 255 })
  testabCriteria: string;

  @Column('boolean', { name: 'testab_sent_after_test' })
  testabSentAfterTest: boolean;

  @Column('int', { name: 'testab_last_id' })
  testabLastId: number;

  @Column('varchar', { name: 'testab_schedule_to_cloud_task_id', length: 255 })
  testabScheduleToCloudTaskId: string;

  @Column('varchar', { name: 'testab_schedule_end_cloud_task_id', length: 255 })
  testabScheduleEndCloudTaskId: string;

  @Column('int', { name: 'recurrence_count' })
  recurrenceCount: number;

  @Column('json', { name: 'recurrence_settings' })
  recurrenceSettings: CampaignRecurrenceSettings;

  @Column('boolean', { name: 'is_warmup', default: false })
  isWarmup: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @ManyToOne(() => AccountEntity, (account) => account.campaigns, {
    eager: true,
    nullable: false,
  })
  @JoinColumn([{ name: 'account_id', referencedColumnName: 'id' }])
  account: AccountEntity;

  @OneToMany(() => CampaignMessageEntity, (campaignMessage) => campaignMessage.campaign, {
    eager: true,
    nullable: true,
  })
  campaignMessage: Array<CampaignMessageEntity>;

  @OneToOne(() => WarmupEntity, (warmup) => warmup.campaign, {})
  warmup: Array<WarmupEntity>;

  @OneToMany(() => CampaignContactEntity, (campaignContact) => campaignContact.campaign, {})
  campaignContacts?: Array<CampaignContactEntity>;

  @AfterLoad()
  afterload() {
    if (this.type === CampaignType.RECURRING) {
      this.recurrenceSettings = {
        ...this.recurrenceSettings,
        date: new Date(this.recurrenceSettings.date),
        interval: Number(this.recurrenceSettings.interval),
        hasExpiration: !!this.recurrenceSettings.hasExpiration,
        untilDate: this.recurrenceSettings.untilDate ? new Date(this.recurrenceSettings.untilDate) : null,
        untilSend: this.recurrenceSettings.untilSend ? Number(this.recurrenceSettings.untilSend) : null,
        firstSentDate: this.recurrenceSettings.firstSentDate ? new Date(this.recurrenceSettings.firstSentDate) : null,
        lastSentDate: this.recurrenceSettings.lastSentDate ? new Date(this.recurrenceSettings.lastSentDate) : null,
      };
    }
  }
}
