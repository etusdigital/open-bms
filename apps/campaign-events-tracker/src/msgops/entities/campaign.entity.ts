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
import { CampaignContactEntity } from './campaign-contact.entity';
import { CampaignRecurrenceSettings, CampaignsType } from './../../app.interfaces';

@Entity('campaigns')
export class CampaignEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'title', length: 255 })
  title: string;

  @Column('varchar', { name: 'type', length: 30 })
  type: string;

  @Column('varchar', { name: 'publisher', length: 100 })
  publisher: string;

  @Column('timestamptz', { name: 'schedule_to' })
  scheduleTo: Date;

  @Column('varchar', { name: 'schedule_to_cloud_task_id', length: 255 })
  scheduleToCloudTaskId: string;

  @Column('json', { name: 'tags' })
  tags: string;

  @Column('int', { name: 'status' })
  status: number;

  @Column('decimal', { name: 'sent_contacts' })
  sentContacts: number;

  @Column('decimal', { name: 'sent_percentage' })
  sentPercentage: number;

  @Column('json', { name: 'recurrence_settings' })
  recurrenceSettings: CampaignRecurrenceSettings;

  @Column('int', { name: 'recurrence_count' })
  recurrenceCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToMany(() => CampaignContactEntity, (campaignContact: CampaignContactEntity) => campaignContact.campaign, {})
  campaignContacts?: Array<CampaignContactEntity>;

  @AfterLoad()
  afterload() {
    if (this.type === CampaignsType.RECURRING) {
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
