import { BeforeUpdate, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CampaignEntity } from './campaign.entity';

@Entity('warmups')
export class WarmupEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'sender', length: 255 })
  sender: string;

  @Column('varchar', { name: 'ippool', length: 255 })
  ippool: string;

  @Column('varchar', { name: 'reply_to', length: 255 })
  replyTo: string;

  @Column('int', { name: 'current_send' })
  currentSend: number;

  @Column('int', { name: 'remaining_send_today' })
  remainingSendToday: number;

  @Column('int', { name: 'target' })
  target: number;

  @Column('varchar', { name: 'status', length: 20 })
  status: string;

  @Column('int', { name: 'target_account_id' })
  targetAccountId: number;

  @Column('int', { name: 'target_segment_id' })
  target_segment_id: number;

  @Column('int', { name: 'campaign_id' })
  campaignId: number;

  @Column({ name: 'last_sent_at', type: 'timestamptz' })
  lastSentAt: Date;

  @Column('json', { name: 'warmup_info' })
  warmupInfo: any;

  @Column('varchar', { name: 'type', length: 20 })
  type: string;

  @Column('int', { name: 'stage' })
  stage: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @BeforeUpdate()
  callbeforeupdate() {
    this.updatedAt = new Date();
  }

  @OneToOne(() => CampaignEntity, (campaign) => campaign.warmup, {
    eager: true,
    nullable: true,
  })
  @JoinColumn([{ name: 'campaign_id', referencedColumnName: 'id' }])
  campaign: CampaignEntity;
}
