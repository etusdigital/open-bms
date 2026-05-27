import { Entity, ManyToOne, JoinColumn, PrimaryColumn, Column } from 'typeorm';
import { MessageEntity } from './message.entity';
import { CampaignEntity } from './campaign.entity';

@Entity('campaigns_messages')
export class CampaignMessageEntity {
  @PrimaryColumn({ type: 'int', name: 'campaign_id' })
  campaignId: number;

  @PrimaryColumn({ type: 'int', name: 'message_id' })
  messageId: number;

  @Column({ type: 'json', name: 'statistics' })
  statistics: string;

  @Column({ type: 'bool', name: 'winner' })
  winner: boolean;

  @Column({ type: 'timestamp', name: 'result_date' })
  resultDate: Date;

  @ManyToOne(() => CampaignEntity, (campaign) => campaign.campaignMessage, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'campaign_id', referencedColumnName: 'id' }])
  campaign: CampaignEntity;

  @ManyToOne(() => MessageEntity, (message) => message.campaignMessage, {
    eager: true,
    nullable: false,
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'message_id', referencedColumnName: 'id' }])
  message: MessageEntity;
}
